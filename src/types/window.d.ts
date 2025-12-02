import SpinningWheelGame from '@/game';

declare global {
  interface Window {
    game?: SpinningWheelGame;
    wallet?: any;
    updatePointsDisplay?: (points: number) => void;
    requestSpinTransaction?: () => Promise<void>;
    __WHEEL_GAME_INITIALIZED__?: boolean;
    __WHEEL_LISTENERS_BOUND__?: boolean;
    __SPIN_TX_IN_FLIGHT__?: boolean;
    __WHEEL_SPIN_LISTENER_BOUND__?: boolean;
    __WHEEL_CLAIM_LISTENER_BOUND__?: boolean;
    __WHEEL_KEYDOWN_LISTENER_BOUND__?: boolean;
    __WHEEL_COOLDOWN_TIMER_STARTED__?: boolean;
    __WHEEL_SPIN_RESET_CHECKER_STARTED__?: boolean;
    __WHEEL_RESIZE_LISTENER_BOUND__?: boolean;
    __WALLET_EVENT_LISTENER_BOUND__?: boolean;
    handleSpinClick?: () => Promise<void>;
    handleClaimClick?: () => void;
    testWheelLabels?: () => void;
    testButtons?: () => void;
  }
}