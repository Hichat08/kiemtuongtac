import { useAuthStore } from "@/stores/useAuthStore";
import { useChatStore } from "@/stores/useChatStore";
import { MessageCircleMore } from "lucide-react";
import type { KeyboardEvent, PointerEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";

const FLOATING_CHAT_POSITION_KEY = "floating-chat-shortcut-position-v1";
const FLOATING_CHAT_BUTTON_SIZE_PX = 56;
const FLOATING_CHAT_EDGE_GAP_PX = 16;
const FLOATING_CHAT_MOBILE_BOTTOM_OFFSET_PX = 112;
const FLOATING_CHAT_DESKTOP_BOTTOM_OFFSET_PX = 124;
const FLOATING_CHAT_DRAG_THRESHOLD_PX = 6;
const FLOATING_CHAT_SYNC_INTERVAL_MS = 30_000;

type FloatingChatPosition = {
  x: number;
  y: number;
};

type FloatingChatDragState = {
  pointerId: number;
  startX: number;
  startY: number;
  origin: FloatingChatPosition;
  moved: boolean;
};

const getFloatingChatBounds = () => ({
  minX: FLOATING_CHAT_EDGE_GAP_PX,
  maxX: Math.max(
    FLOATING_CHAT_EDGE_GAP_PX,
    window.innerWidth - FLOATING_CHAT_BUTTON_SIZE_PX - FLOATING_CHAT_EDGE_GAP_PX
  ),
  minY: FLOATING_CHAT_EDGE_GAP_PX,
  maxY: Math.max(
    FLOATING_CHAT_EDGE_GAP_PX,
    window.innerHeight - FLOATING_CHAT_BUTTON_SIZE_PX - FLOATING_CHAT_EDGE_GAP_PX
  ),
});

const clampFloatingChatPosition = (position: FloatingChatPosition) => {
  const bounds = getFloatingChatBounds();

  return {
    x: Math.min(bounds.maxX, Math.max(bounds.minX, position.x)),
    y: Math.min(bounds.maxY, Math.max(bounds.minY, position.y)),
  };
};

const getDefaultFloatingChatPosition = () => {
  const bounds = getFloatingChatBounds();
  const bottomOffset =
    window.innerWidth >= 640
      ? FLOATING_CHAT_DESKTOP_BOTTOM_OFFSET_PX
      : FLOATING_CHAT_MOBILE_BOTTOM_OFFSET_PX;

  return clampFloatingChatPosition({
    x: bounds.maxX,
    y: bounds.maxY - bottomOffset,
  });
};

const readStoredFloatingChatPosition = () => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const storedValue = window.localStorage.getItem(FLOATING_CHAT_POSITION_KEY);

    if (!storedValue) {
      return null;
    }

    const parsedValue = JSON.parse(storedValue) as Partial<FloatingChatPosition>;

    if (
      typeof parsedValue?.x !== "number" ||
      !Number.isFinite(parsedValue.x) ||
      typeof parsedValue?.y !== "number" ||
      !Number.isFinite(parsedValue.y)
    ) {
      return null;
    }

    return clampFloatingChatPosition({
      x: parsedValue.x,
      y: parsedValue.y,
    });
  } catch (error) {
    console.error("Không đọc được vị trí nút chat nổi", error);
    return null;
  }
};

const persistFloatingChatPosition = (position: FloatingChatPosition) => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(FLOATING_CHAT_POSITION_KEY, JSON.stringify(position));
  } catch (error) {
    console.error("Không lưu được vị trí nút chat nổi", error);
  }
};

export function FloatingChatShortcut() {
  const { accessToken, user } = useAuthStore();
  const conversations = useChatStore((state) => state.conversations);
  const fetchConversations = useChatStore((state) => state.fetchConversations);
  const location = useLocation();
  const navigate = useNavigate();
  const [position, setPosition] = useState<FloatingChatPosition | null>(null);
  const positionRef = useRef<FloatingChatPosition | null>(null);
  const dragStateRef = useRef<FloatingChatDragState | null>(null);

  const shouldHide =
    !accessToken || !user || user.role === "admin" || location.pathname.startsWith("/chat");

  const unreadCount = conversations.reduce(
    (total, conversation) =>
      total + Math.max(0, conversation.unreadCounts?.[user?._id ?? ""] ?? 0),
    0
  );

  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  useEffect(() => {
    if (shouldHide || positionRef.current) {
      return;
    }

    const nextPosition =
      readStoredFloatingChatPosition() ?? getDefaultFloatingChatPosition();

    positionRef.current = nextPosition;
    setPosition(nextPosition);
  }, [shouldHide]);

  useEffect(() => {
    if (shouldHide) {
      return;
    }

    let active = true;

    const syncConversations = async () => {
      try {
        await fetchConversations();
      } catch (error) {
        if (!active) {
          return;
        }

        console.error("Không đồng bộ được hội thoại cho nút chat nổi", error);
      }
    };

    const handleWindowFocus = () => {
      void syncConversations();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void syncConversations();
      }
    };

    void syncConversations();

    const intervalId = window.setInterval(() => {
      void syncConversations();
    }, FLOATING_CHAT_SYNC_INTERVAL_MS);

    window.addEventListener("focus", handleWindowFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleWindowFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [fetchConversations, shouldHide]);

  useEffect(() => {
    if (shouldHide) {
      return;
    }

    const handleResize = () => {
      const nextPosition = clampFloatingChatPosition(
        positionRef.current ?? getDefaultFloatingChatPosition()
      );

      positionRef.current = nextPosition;
      setPosition(nextPosition);
      persistFloatingChatPosition(nextPosition);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [shouldHide]);

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (!positionRef.current) {
      return;
    }

    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origin: positionRef.current,
      moved: false,
    };

    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const dragState = dragStateRef.current;

    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    const deltaX = event.clientX - dragState.startX;
    const deltaY = event.clientY - dragState.startY;

    if (
      !dragState.moved &&
      Math.hypot(deltaX, deltaY) >= FLOATING_CHAT_DRAG_THRESHOLD_PX
    ) {
      dragState.moved = true;
    }

    if (!dragState.moved) {
      return;
    }

    event.preventDefault();

    const nextPosition = clampFloatingChatPosition({
      x: dragState.origin.x + deltaX,
      y: dragState.origin.y + deltaY,
    });

    positionRef.current = nextPosition;
    setPosition(nextPosition);
  };

  const completePointerInteraction = (
    event: PointerEvent<HTMLButtonElement>,
    shouldNavigate: boolean
  ) => {
    const dragState = dragStateRef.current;

    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    dragStateRef.current = null;

    if (positionRef.current) {
      persistFloatingChatPosition(positionRef.current);
    }

    if (!dragState.moved && shouldNavigate) {
      navigate("/chat");
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    navigate("/chat");
  };

  if (shouldHide || !position) {
    return null;
  }

  return (
    <button
      type="button"
      aria-label="Mở trò chuyện"
      title="Kéo để đổi vị trí, chạm để mở trò chuyện"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={(event) => completePointerInteraction(event, true)}
      onPointerCancel={(event) => completePointerInteraction(event, false)}
      onKeyDown={handleKeyDown}
      className="fixed z-40 flex size-14 select-none items-center justify-center rounded-full bg-gradient-primary text-white shadow-[0_16px_35px_-18px_rgba(123,25,216,0.6)] transition-transform duration-150 active:scale-95 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#7b19d8]/18"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        touchAction: "none",
      }}
    >
      {unreadCount > 0 ? (
        <>
          <span className="pointer-events-none absolute right-2 top-2 size-2 rounded-full bg-[#ff4a90] ring-2 ring-white dark:ring-[#12081d]" />
          <span className="pointer-events-none absolute -right-1 -top-1 flex min-w-5 items-center justify-center rounded-full bg-[#ff4a90] px-1.5 py-0.5 text-[10px] font-bold leading-none text-white shadow-[0_10px_20px_-14px_rgba(255,74,144,0.9)]">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        </>
      ) : (
        <span className="pointer-events-none absolute right-2 top-2 size-2 rounded-full bg-white/80 shadow-[0_0_0_3px_rgba(255,255,255,0.12)]" />
      )}
      <MessageCircleMore
        className="size-6"
        strokeWidth={2.25}
      />
    </button>
  );
}
