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
  // Refreshed after commit rather than during render: the handlers below only read this ref from
  // SignalR events, which never fire during a render pass.
  useEffect(() => {
    callbacksRef.current = callbacks;
  });

  useEffect(() => {
    if (!isInitialized || !isAuthenticated) return;

    // Cookie auth: the first-party HttpOnly session cookie is sent automatically on the negotiate
    // request and on the negotiated transport (withCredentials); no access_token query param is
    // exposed to JS. Production runs over Server-Sent Events rather than a WebSocket — the
    // same-origin proxy that makes the cookie first-party cannot tunnel an upgrade.
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

    // Groups are keyed by connection id, and withAutomaticReconnect() recovers with a NEW connection
    // id — the membership established by the initial JoinWallGroup is gone server-side. Without this
    // re-join the socket reports Connected while silently delivering no wall event at all, which is
    // indistinguishable from an idle wall. No equivalent is needed for the personal notification
    // group: the hub re-adds it in OnConnectedAsync, which runs again for every new connection.
    connection.onreconnected(() => {
      connection.invoke('JoinWallGroup', patientId).catch(err => {
        console.warn('[CollaborativeWallSocket] Failed to rejoin the wall group after reconnect — real-time updates are stale.', err);
      });
    });

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
