import { useEffect, useRef } from 'react';
import { HubConnectionBuilder, type HubConnection } from '@microsoft/signalr';
import { useAuth } from '../../auth';
import { API_BASE } from '../../../services/apiClient';
import type { CommentResponse, PostResponse } from '../../../types/wall';

interface CollaborativeWallSocketCallbacks {
  onPostReceived: (post: PostResponse) => void;
  onPostUpdated: (post: PostResponse) => void;
  onPostDeleted: (postId: string) => void;
  onCommentReceived: (comment: CommentResponse) => void;
  onCommentUpdated: (comment: CommentResponse) => void;
  onCommentDeleted: (postId: string, commentId: string) => void;
}

export function useCollaborativeWallSocket(
  patientId: string,
  callbacks: CollaborativeWallSocketCallbacks,
): void {
  const { isAuthenticated, isInitialized } = useAuth();

  // Ref-stabilised callbacks prevent the connection from being torn down and rebuilt
  // whenever the parent renders a new function instance.
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  useEffect(() => {
    if (!isInitialized || !isAuthenticated) return;

    // Cookie auth: the same-site HttpOnly session cookie is sent automatically on the negotiate
    // request and WebSocket upgrade (withCredentials); no access_token query param is exposed to JS.
    const connection: HubConnection = new HubConnectionBuilder()
      .withUrl(`${API_BASE}/hubs/collaborative-wall`, {
        withCredentials: true,
      })
      .withAutomaticReconnect()
      .build();

    let cancelled = false;

    connection.on('ReceiveNewPost',       (post: PostResponse)       => callbacksRef.current.onPostReceived(post));
    connection.on('ReceiveUpdatedPost',   (post: PostResponse)       => callbacksRef.current.onPostUpdated(post));
    connection.on('ReceiveDeletedPost',   (postId: string)           => callbacksRef.current.onPostDeleted(postId));
    connection.on('ReceiveNewComment',    (comment: CommentResponse) => callbacksRef.current.onCommentReceived(comment));
    connection.on('ReceiveUpdatedComment',(comment: CommentResponse) => callbacksRef.current.onCommentUpdated(comment));
    connection.on('ReceiveDeletedComment',(postId: string, commentId: string) => callbacksRef.current.onCommentDeleted(postId, commentId));

    // Retain the start promise so cleanup can wait for negotiation to settle before stopping.
    // Stopping a connection mid-negotiation makes SignalR log "The connection was stopped during
    // negotiation" — notably on React StrictMode's mount → unmount → mount in development.
    const startPromise = connection
      .start()
      .then(() => connection.invoke('JoinWallGroup', patientId))
      .catch(err => {
        if (!cancelled) {
          console.warn('[CollaborativeWallSocket] Connection failed — real-time updates unavailable.', err);
        }
      });

    return () => {
      cancelled = true;
      connection.off('ReceiveNewPost');
      connection.off('ReceiveUpdatedPost');
      connection.off('ReceiveDeletedPost');
      connection.off('ReceiveNewComment');
      connection.off('ReceiveUpdatedComment');
      connection.off('ReceiveDeletedComment');
      // Defer stop() until start() has settled so we never abort an in-flight negotiation.
      void startPromise.then(() => connection.stop()).catch(() => {});
    };
  }, [patientId, isInitialized, isAuthenticated]);
}
