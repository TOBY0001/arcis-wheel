import ArciumWheelClient from './utils/arciumClient';

/**
 * Get current UTC date string in YYYY-MM-DD format
 * This ensures spins reset at 12am UTC regardless of user's timezone
 */
function getUTCDateString(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

class SpinningWheelGame {
    // DOM elements YHH
    canvas: HTMLCanvasElement | null;
    ctx: CanvasRenderingContext2D | null | undefined;
    pointsValue: HTMLElement | null;
    claimButton: HTMLButtonElement | null;
    spinButton: HTMLButtonElement | null; // Deprecated - use spin-button-daily and spin-button-unlimited
    resultText: HTMLElement | null;
    leaderboardList: Element | null;

    // Game state
    isSpinning: boolean;
    currentResult: string | null;
    playerCredits: number;
    playerName: string;
    walletAddress: { textContent: string };
    lastClaimTime: number | null;

    // Arcium client
    arciumClient: ArciumWheelClient | null;
    isComputationInitialized: boolean;

    // Spin limit tracking
    spinsPerDay: number; // Daily spins limit (5 for daily spins)
    spinsUsedToday: number; // Daily spins used today
    lastSpinResetDate: string | null;

    // Wheel configuration
    wheelValues: string[];
    wheelSections: number;
    sectionAngle: number;

    // Wallet
    wallet: any;

    // Leaderboard
    fullLeaderboard: any[] | undefined;

    constructor() {
      // DOM elements
      this.canvas = document.getElementById('wheelCanvas') as HTMLCanvasElement | null;
      this.ctx = this.canvas?.getContext('2d');
      this.pointsValue = document.querySelector('.points-value') as HTMLElement | null;
      this.claimButton = document.querySelector('.claim-button') as HTMLButtonElement | null;
      // Deprecated: spinButton - now using separate daily and unlimited buttons
      this.spinButton = null;
      this.resultText = document.querySelector('.result-text') as HTMLElement | null;
      this.leaderboardList = document.querySelector('.leaderboard-list');
      
      console.log('Game constructor - DOM elements found:');
      console.log('Canvas:', !!this.canvas);
      console.log('Points value:', !!this.pointsValue);
      console.log('Claim button:', !!this.claimButton);
      console.log('Spin button:', !!this.spinButton);
      console.log('Result text:', !!this.resultText);
      console.log('Leaderboard list:', !!this.leaderboardList);
  
      // Game state
      this.isSpinning = false;
      this.currentResult = null;
      this.playerCredits = 0;
      this.playerName = ''; // No name until wallet connects
      this.walletAddress = { textContent: 'Not connected' };
      this.lastClaimTime = null;

      // Arcium client for encrypted computations
      this.arciumClient = null;
      this.isComputationInitialized = false;
      
      if (typeof window !== 'undefined') {
        try {
          this.arciumClient = new ArciumWheelClient();
        } catch (error) {
          console.warn('Failed to initialize Arcium client:', error);
          this.arciumClient = null;
        }
      }
  
      // Spin limit tracking (5 daily spins for ranked play)
      this.spinsPerDay = 5;
      this.spinsUsedToday = 0;
      this.lastSpinResetDate = null;
  
      // Wheel configuration
      // Segments are ordered clockwise starting from top (where red pointer is)
      this.wheelValues = ['2x', '3x', '0.5x', '-0.6x', '-20%', '30%', '-50%', '-80%'];
      this.wheelSections = 8;
      this.sectionAngle = 360 / this.wheelSections;

      // Initialize
      this.initWalletIntegration();
      this.loadGameData();
      this.setupEventListeners();
      this.drawWheel();
      this.updateDisplay();
      this.checkSpinLimit();
      this.checkClaimCooldown();
      // Check for weekly reset
      this.checkWeeklyReset();
      // Leaderboard disabled for now
      this.loadAndDisplayLeaderboard();
      
      // Retry finding DOM elements if not found initially
      if (!this.claimButton || !this.spinButton) {
        console.log('Some DOM elements not found, retrying in 100ms...');
        setTimeout(() => {
          this.retryFindDOMElements();
        }, 100);
      }

      // Add global fallback for button clicks
      (window as any).handleDailySpinClick = async () => {
        console.log('Global daily spin handler called');
        await this.spinWheelDaily();
      };
      
      (window as any).handleUnlimitedSpinClick = async () => {
        console.log('Global unlimited spin handler called');
        await this.spinWheelUnlimited();
      };

      (window as any).handleClaimClick = async () => {
        console.log('Global claim handler called');
        await this.claimBasePoints();
      };
    }

    /**
     * Retry finding DOM elements if they weren't found initially
     */
    retryFindDOMElements() {
      console.log('Retrying to find DOM elements...');
      
      if (!this.claimButton) {
        this.claimButton = document.querySelector('.claim-button');
        console.log('Claim button retry:', !!this.claimButton);
      }
      
      // Note: spinButton is deprecated, using spin-button-daily and spin-button-unlimited instead
      
      if (!this.pointsValue) {
        this.pointsValue = document.querySelector('.points-value');
        console.log('Points value retry:', !!this.pointsValue);
      }
      
      if (!this.resultText) {
        this.resultText = document.querySelector('.result-text');
        console.log('Result text retry:', !!this.resultText);
      }
      
      if (!this.leaderboardList) {
        this.leaderboardList = document.querySelector('.leaderboard-list');
        console.log('Leaderboard list retry:', !!this.leaderboardList);
      }
      
      // Retry setting up event listeners if buttons are now found
      const dailySpinButton = document.querySelector('.spin-button-daily');
      const unlimitedSpinButton = document.querySelector('.spin-button-unlimited');
      if (this.claimButton || dailySpinButton || unlimitedSpinButton) {
        this.setupEventListeners();
      }
      
      // Retry drawing wheel if canvas is now found
      if (this.canvas) {
        this.drawWheel();
      }
    }

    /**
     * Draw the wheel with labels
     */
    drawWheel() {
      const wheelLabelsContainer = document.querySelector('.wheel-labels') as HTMLElement | null;
      if (!wheelLabelsContainer) {
        console.log('Wheel labels container not found, retrying in 100ms...');
        setTimeout(() => this.drawWheel(), 100);
        return;
      }

      console.log('Drawing wheel with labels...');
      console.log('Wheel values:', this.wheelValues);
      console.log('Wheel sections:', this.wheelSections);
      console.log('Wheel labels container found:', !!wheelLabelsContainer);
      console.log('Container position:', wheelLabelsContainer.getBoundingClientRect());
      
      // Clear existing labels
      wheelLabelsContainer.innerHTML = '';

      // Create labels for each wheel section
      for (let i = 0; i < this.wheelSections; i++) {
        const label = document.createElement('div');
        label.className = 'wheel-label';
        label.textContent = this.wheelValues[i];
        
        // Calculate position for each label
        // Start from top (-90 degrees) and position slightly counter-clockwise as marked with green
        const angle = (i * this.sectionAngle) - 90 + (this.sectionAngle / 2) - 20; // Moved slightly left to match green marks
        const radians = (angle * Math.PI) / 180;
        // Reduce radius on mobile to keep labels inside wheel
        const isMobile = window.innerWidth <= 768;
        const radius = isMobile ? 100 : 125; // Smaller radius on mobile to keep labels contained
        
        // Position the label
        const x = Math.cos(radians) * radius;
        const y = Math.sin(radians) * radius;
        
        label.style.left = `calc(50% + ${x}px)`;
        label.style.top = `calc(50% + ${y}px)`;
        label.style.transform = 'translate(-50%, -50%)';
        label.style.position = 'absolute';
        label.style.display = 'block';
        label.style.visibility = 'visible';
        label.style.opacity = '1';
        label.style.zIndex = '10';
        label.style.pointerEvents = 'none';
        
        console.log(`Creating label ${i}: ${this.wheelValues[i]} at angle ${angle}deg, position (${x}, ${y})`);
        
        wheelLabelsContainer.appendChild(label);
      }
      
      console.log(`Created ${this.wheelSections} wheel labels`);
      console.log('Wheel labels container children:', wheelLabelsContainer.children.length);
      
      // Verify labels are visible
      const labels = wheelLabelsContainer.querySelectorAll('.wheel-label');
      console.log('Labels created:', labels.length);
      labels.forEach((label, index) => {
        const htmlLabel = label as HTMLElement;
        console.log(`Label ${index}:`, htmlLabel.textContent, htmlLabel.style.left, htmlLabel.style.top);
      });
      
      // Expose global functions for testing
      (window as any).testWheelLabels = () => {
        console.log('Testing wheel labels...');
        this.drawWheel();
      };

      (window as any).testButtons = () => {
        console.log('Testing button functionality...');
        console.log('Spin button found:', !!this.spinButton);
        console.log('Claim button found:', !!this.claimButton);
        console.log('Game instance:', !!this);
        console.log('Window handlers:', {
          handleSpinClick: !!(window as any).handleSpinClick,
          handleClaimClick: !!(window as any).handleClaimClick
        });
      };
    }
  
    setupEventListeners() {
      console.log('Setting up event listeners...');
      console.log('Spin button found:', !!this.spinButton);
      console.log('Claim button found:', !!this.claimButton);
      
      // Use event delegation to handle buttons even if they're not found initially
      if (!window.__WHEEL_SPIN_LISTENER_BOUND__) {
        console.log('Adding spin button listeners via delegation');
        document.addEventListener('click', async (e) => {
          console.log('Document click event:', e.target);
          const target = e.target as HTMLElement;
          if (target && target.classList.contains('spin-button-daily')) {
            console.log('Daily spin button clicked via delegation!');
            e.preventDefault();
            await this.spinWheelDaily();
          } else if (target && target.classList.contains('spin-button-unlimited')) {
            console.log('Unlimited spin button clicked via delegation!');
            e.preventDefault();
            await this.spinWheelUnlimited();
          }
        });
        window.__WHEEL_SPIN_LISTENER_BOUND__ = true;
      }
      
      if (!window.__WHEEL_CLAIM_LISTENER_BOUND__) {
        console.log('Adding claim button listener via delegation');
        document.addEventListener('click', async (e) => {
          console.log('Document click event:', e.target);
          if (e.target && (e.target as HTMLElement).classList.contains('claim-button')) {
            console.log('Claim button clicked via delegation!');
            e.preventDefault();
            await this.claimBasePoints();
          }
        });
        window.__WHEEL_CLAIM_LISTENER_BOUND__ = true;
      }
      
      // Also try direct listeners if buttons are available
      const dailySpinButton = document.querySelector('.spin-button-daily') as HTMLButtonElement | null;
      const unlimitedSpinButton = document.querySelector('.spin-button-unlimited') as HTMLButtonElement | null;
      
      if (dailySpinButton && !dailySpinButton.onclick) {
        console.log('Adding direct daily spin button listener');
        dailySpinButton.addEventListener('click', async (e) => {
          console.log('Daily spin button clicked directly!');
          e.preventDefault();
          await this.spinWheelDaily();
        });
      }
      
      if (unlimitedSpinButton && !unlimitedSpinButton.onclick) {
        console.log('Adding direct unlimited spin button listener');
        unlimitedSpinButton.addEventListener('click', async (e) => {
          console.log('Unlimited spin button clicked directly!');
          e.preventDefault();
          await this.spinWheelUnlimited();
        });
      }
      
      if (this.claimButton && !this.claimButton.onclick) {
        console.log('Adding direct claim button listener');
        this.claimButton.addEventListener('click', async (e) => {
          console.log('Claim button clicked directly!');
          e.preventDefault();
          await this.claimBasePoints();
        });
      }
      
      // Keyboard shortcut (triggers daily spin)
      if (!window.__WHEEL_KEYDOWN_LISTENER_BOUND__) {
        document.addEventListener('keydown', async (e) => {
          if (e.code === 'Space' && !this.isSpinning) {
            e.preventDefault();
            await this.spinWheelDaily();
          }
        });
        window.__WHEEL_KEYDOWN_LISTENER_BOUND__ = true;
      }
      
      // Start cooldown timer
      if (!window.__WHEEL_COOLDOWN_TIMER_STARTED__) {
        setInterval(() => {
          this.checkClaimCooldown();
        }, 1000);
        window.__WHEEL_COOLDOWN_TIMER_STARTED__ = true;
      }
      
      // Start daily spin reset checker (checks every minute for UTC day change)
      if (!window.__WHEEL_SPIN_RESET_CHECKER_STARTED__) {
        setInterval(() => {
          this.checkSpinLimit(); // This will reset if it's a new UTC day
        }, 60000); // Check every minute
        window.__WHEEL_SPIN_RESET_CHECKER_STARTED__ = true;
      }
    }
  
    initWalletIntegration() {
      window.addEventListener('wallet-connected', (event) => {
        const { publicKey, wallet } = event.detail;
        if (publicKey) {
          const walletAddressStr = publicKey.toString();
          this.walletAddress.textContent = walletAddressStr.slice(0, 8) + '...';
          
          // Store wallet reference for Arcium operations
          this.wallet = wallet || window.wallet;
          
          if (!this.wallet) {
            console.error('No wallet available');
            return;
          }
          
          console.log('Wallet connected:', this.wallet.publicKey?.toString());
          
          // Initialize player account for this wallet address
          this.initializePlayerAccount(walletAddressStr).then(async () => {
            this.showSuccess('Wallet connected successfully!');
            // Dispatch event to update React state with loaded username
            window.dispatchEvent(new CustomEvent('player-data-loaded', {
              detail: { username: this.playerName }
            }));
            // Don't save immediately after loading - data is already loaded from API
            // Only update leaderboard to show current position
            await this.updateLeaderboard().catch(console.error);
          }).catch(console.error);
          
          // Initialize Arcium computation
          this.initializeArciumComputation().catch(console.error);
        } else {
          this.walletAddress.textContent = 'Not connected';
          this.playerName = ''; // Clear name when disconnected
          this.playerCredits = 0; // Reset credits
          this.wallet = null;
          this.showError('Wallet disconnected');
          this.updateLeaderboard().catch(console.error);
          this.saveGameData().catch(console.error);
        }
      });
    }

    /**
     * Initialize player account for a specific wallet address
     */
    async initializePlayerAccount(walletAddress: string) {
      try {
        console.log(`[Game] Initializing player account for: ${walletAddress}`);
        
        // Fetch player data from API (will initialize if not exists)
        const response = await fetch(`/api/player?walletAddress=${encodeURIComponent(walletAddress)}`);
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to fetch player data: ${response.status} ${errorText}`);
        }
        
        const data = await response.json();
        console.log(`[Game] Loaded player data:`, data);
        
        if (data.player) {
          this.playerCredits = data.player.credits ?? 0;
          this.playerName = data.player.username || `Player_${walletAddress.slice(0, 4)}`;
          this.lastClaimTime = data.player.claimTime ?? null;
          
          // Load spinsLeft from database and convert to spinsUsedToday
          const savedSpinsLeft = data.player.spinsLeft ?? 5;
          this.spinsUsedToday = this.spinsPerDay - savedSpinsLeft;
          
          // Check if we need to reset for a new day (UTC-based)
          const todayUTC = getUTCDateString();
          if (this.lastSpinResetDate !== todayUTC) {
            // New day - reset spin count (resets at 12am UTC regardless of usage)
            this.spinsUsedToday = 0;
            this.lastSpinResetDate = todayUTC;
            // Save the reset immediately
            await this.saveGameData().catch(console.error);
          } else {
            // Same day - use saved value
            this.lastSpinResetDate = todayUTC;
          }
          
          console.log(`[Game] Player initialized: credits=${this.playerCredits}, username=${this.playerName}, claimTime=${this.lastClaimTime}, spinsUsedToday=${this.spinsUsedToday}, spinsLeft=${savedSpinsLeft}`);
        } else {
          // Fallback to defaults if API returns no data
          console.warn('[Game] No player data returned, using defaults');
          this.playerCredits = 0;
          this.playerName = `Player_${walletAddress.slice(0, 4)}`;
          this.lastClaimTime = null;
          this.spinsUsedToday = 0;
          this.lastSpinResetDate = null;
        }
        
        this.updateDisplay();
        this.checkSpinLimit();
        this.checkClaimCooldown();
      } catch (error) {
        console.error('[Game] Error initializing player account:', error);
        // Fallback to defaults on error
        this.playerCredits = 0;
        this.playerName = `Player_${walletAddress.slice(0, 4)}`;
        this.lastClaimTime = null;
        this.spinsUsedToday = 0;
        this.lastSpinResetDate = null;
        this.updateDisplay();
        this.checkSpinLimit();
        this.checkClaimCooldown();
      }
    }
  
  
    /**
     * Spin wheel with daily limit (5 spins per day) - counts towards leaderboard
     */
    async spinWheelDaily() {
      if (this.isSpinning) return;

      // Check wallet connection
      if (this.walletAddress.textContent === 'Not connected') {
        this.showError('Please connect your wallet to spin the wheel');
        return;
      }

      // Check daily spin limit (UTC-based reset at 12am UTC)
      const todayUTC = getUTCDateString();
      if (this.lastSpinResetDate !== todayUTC) {
        // New day - reset spin count (resets at 12am UTC regardless of usage)
        this.spinsUsedToday = 0;
        this.lastSpinResetDate = todayUTC;
        // Save the reset immediately
        await this.saveGameData().catch(console.error);
      }

      if (this.spinsUsedToday >= this.spinsPerDay) {
        this.showError(`Daily spin limit reached! You've used all ${this.spinsPerDay} spins today.`);
        this.checkSpinLimit();
        return;
      }

      this.isSpinning = true;
      const dailySpinButton = document.querySelector('.spin-button-daily') as HTMLButtonElement | null;
      const unlimitedSpinButton = document.querySelector('.spin-button-unlimited') as HTMLButtonElement | null;
      if (dailySpinButton) dailySpinButton.disabled = true;
      if (unlimitedSpinButton) unlimitedSpinButton.disabled = true;
      if (this.claimButton) this.claimButton.disabled = false;

      try {
        this.resultText.textContent = 'Spinning the wheel (Daily)...';
        this.resultText.style.background = 'rgba(139, 92, 246, 0.2)';
        this.resultText.style.borderColor = 'rgba(139, 92, 246, 0.5)';

        // Submit Arcium computation (handles transaction internally)
        try {
          await this.spinWheelWithArcium(true); // true = counts to leaderboard
        } catch (arciumError) {
          console.warn('Arcium integration failed, using demo mode:', arciumError);
          await this.spinWheelDemo(true); // true = counts to leaderboard
        }

      } catch (error) {
        console.error('Error spinning wheel:', error);
        this.showError('Failed to spin wheel');
        this.resetSpinState();
      }
    }

    /**
     * Spin wheel unlimited (practice mode) - does NOT count towards leaderboard
     */
    async spinWheelUnlimited() {
      if (this.isSpinning) return;

      // Check wallet connection
      if (this.walletAddress.textContent === 'Not connected') {
        this.showError('Please connect your wallet to spin the wheel');
        return;
      }

      this.isSpinning = true;
      const dailySpinButton = document.querySelector('.spin-button-daily') as HTMLButtonElement | null;
      const unlimitedSpinButton = document.querySelector('.spin-button-unlimited') as HTMLButtonElement | null;
      if (dailySpinButton) dailySpinButton.disabled = true;
      if (unlimitedSpinButton) unlimitedSpinButton.disabled = true;
      if (this.claimButton) this.claimButton.disabled = false;

      try {
        this.resultText.textContent = 'Spinning the wheel (Practice)...';
        this.resultText.style.background = 'rgba(139, 92, 246, 0.2)';
        this.resultText.style.borderColor = 'rgba(139, 92, 246, 0.5)';

        // Submit Arcium computation (handles transaction internally)
        try {
          await this.spinWheelWithArcium(false); // false = doesn't count to leaderboard
        } catch (arciumError) {
          console.warn('Arcium integration failed, using demo mode:', arciumError);
          await this.spinWheelDemo(false); // false = doesn't count to leaderboard
        }

      } catch (error) {
        console.error('Error spinning wheel:', error);
        this.showError('Failed to spin wheel');
        this.resetSpinState();
      }
    }

    resetSpinState() {
      this.isSpinning = false;
      const dailySpinButton = document.querySelector('.spin-button-daily') as HTMLButtonElement | null;
      const unlimitedSpinButton = document.querySelector('.spin-button-unlimited') as HTMLButtonElement | null;
      if (dailySpinButton) dailySpinButton.disabled = false;
      if (unlimitedSpinButton) unlimitedSpinButton.disabled = false;
      if (this.claimButton) this.claimButton.disabled = false;
    }

    /**
     * Spin the wheel using Arcium
     * @param countToLeaderboard - if true, this spin counts towards leaderboard ranking
     */
    async spinWheelWithArcium(countToLeaderboard: boolean = true) {
      try {
        if (!this.arciumClient) {
          throw new Error('Arcium client not available');
        }

        if (!this.isComputationInitialized) {
          await this.initializeArciumComputation();
        }

        console.log('🎲 Submitting spin...');
        
        // Submit computation
        const { computationId, result, signature } = await this.arciumClient.submitSpinComputation(
          this.wallet, 
          this.wheelSections
        );

        console.log('Result:', result);

        // Handle result with transaction signature
        await this.handleArciumSpinResult(result, signature, countToLeaderboard);

      } catch (error) {
        console.error('Spin error:', error);
        
        if (error.message.includes('user rejected') || error.message.includes('User rejected')) {
          this.showError('Transaction cancelled');
        } else if (error.message.includes('insufficient funds')) {
          this.showError('Insufficient SOL for fees');
        } else if (error.message.includes('network') || error.message.includes('connection')) {
          this.showError('Network error');
        } else {
          this.showError(`Spin failed: ${error.message}`);
        }
        
        this.isSpinning = false;
        const dailySpinButton = document.querySelector('.spin-button-daily') as HTMLButtonElement | null;
        const unlimitedSpinButton = document.querySelector('.spin-button-unlimited') as HTMLButtonElement | null;
        if (dailySpinButton) dailySpinButton.disabled = false;
        if (unlimitedSpinButton) unlimitedSpinButton.disabled = false;
        if (this.claimButton) this.claimButton.disabled = false;
        this.updateDisplay();
      }
    }

    /**
     * Demo mode fallback
     * @param countToLeaderboard - if true, this spin counts towards leaderboard ranking
     */
    async spinWheelDemo(countToLeaderboard: boolean = true) {
      try {
        console.log('Using demo mode');
        
        this.resultText.textContent = 'Spinning (demo mode)...';
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const randomSegment = Math.floor(Math.random() * this.wheelSections) + 1;
        
        await this.handleArciumSpinResult(randomSegment, null, countToLeaderboard);

      } catch (error) {
        console.error('Demo spin error:', error);
        throw error;
      }
    }

    /**
     * Initialize Arcium computation definition
     * The CompDef should already be initialized via `anchor test`
     * We just check that it exists and is ready to use
     */
    async initializeArciumComputation() {
      if (this.isComputationInitialized) return;
      
      try {
        if (!this.arciumClient) {
          throw new Error('Arcium client not available');
        }

        if (!this.wallet || !this.wallet.publicKey) {
          throw new Error('Wallet not connected');
        }

        console.log('🔧 Initializing Arcium client...');
        
        // Create Anchor provider
        const { AnchorProvider } = await import('@coral-xyz/anchor');
        const { Connection } = await import('@solana/web3.js');
        const connection = new Connection(
          process.env.NEXT_PUBLIC_SOLANA_RPC_HOST || 'https://api.devnet.solana.com'
        );
        const provider = new AnchorProvider(connection, this.wallet, { commitment: 'confirmed' });
        
        // Initialize client
        await this.arciumClient.initialize(provider);
        
        // Check that computation definition exists (should be set up via anchor test)
        console.log('🔧 Checking computation definition...');
        const compDefExists = await this.arciumClient.checkComputationDefinition();
        
        if (!compDefExists) {
          throw new Error(
            'Computation definition not found. ' +
            'Please run: cd backend/encrypted_wheel && anchor test'
          );
        }
        
        this.isComputationInitialized = true;
        console.log('✅ Arcium ready!');
        
        this.showSuccess('Ready to spin!');
      } catch (error) {
        console.error('Failed to initialize Arcium:', error);
        
        if (error.message.includes('Wallet not connected')) {
          this.showError('Please connect your wallet');
        } else if (error.message.includes('not found') || error.message.includes('anchor test')) {
          this.showError('Setup incomplete. Run: anchor test in backend/encrypted_wheel');
        } else if (error.message.includes('network') || error.message.includes('connection')) {
          this.showError('Network error. Check your connection.');
        } else {
          this.showError(`Setup failed: ${error.message}`);
        }
        
        throw error;
      }
    }

    /**
     * Handle spin result
     * @param result - the spin result (segment number)
     * @param transactionSignature - optional transaction signature
     * @param countToLeaderboard - if true, this spin counts towards leaderboard ranking
     */
    async handleArciumSpinResult(result, transactionSignature = null, countToLeaderboard: boolean = true) {
      try {
        // Convert 1-based result to 0-based segment index
        const segmentIndex = Math.max(0, Math.min(result - 1, this.wheelSections - 1));
        
        console.log('Arcium Result:', result, '→ Segment:', segmentIndex, '→ Value:', this.wheelValues[segmentIndex]);
        
        // Simple spinning animation - just spin for visual effect
        // 8-12 full rotations + random ending position
        const spins = 8 + Math.random() * 4; // 8-12 full spins
        const randomEndAngle = Math.random() * 360; // Random final position
        const totalRotation = (spins * 360) + randomEndAngle;

        console.log(`Spinning ${spins.toFixed(1)} times to ${totalRotation.toFixed(1)}°`);

        if (this.canvas) {
          this.canvas.style.transition = 'transform 3.5s cubic-bezier(0.25, 0.1, 0.25, 1)';
          this.canvas.style.transform = `rotate(${totalRotation}deg)`;
        }
        
        const wheelLabelsContainer = document.querySelector('.wheel-labels') as HTMLElement | null;
        if (wheelLabelsContainer) {
          wheelLabelsContainer.style.transition = 'transform 3.5s cubic-bezier(0.25, 0.1, 0.25, 1)';
          wheelLabelsContainer.style.transform = `translate(-50%, -50%) rotate(${totalRotation}deg)`;
        }

        // Update state
        this.currentResult = this.wheelValues[segmentIndex];
        
        // Update daily spin count if this is a daily spin
        if (countToLeaderboard) {
          const todayUTC = getUTCDateString();
          if (this.lastSpinResetDate !== todayUTC) {
            // New day - reset spin count (resets at 12am UTC regardless of usage)
            this.spinsUsedToday = 0;
            this.lastSpinResetDate = todayUTC;
          }
          this.spinsUsedToday++;
        }
        
        this.applyResult(this.currentResult, countToLeaderboard);

        // Display result with explorer link
        let resultMessage = `You got: ${this.currentResult}!`;
        if (transactionSignature) {
          resultMessage += ` | `;
        }
        this.resultText.innerHTML = resultMessage;
        
        if (transactionSignature) {
          const explorerLink = document.createElement('a');
          explorerLink.href = `https://explorer.solana.com/tx/${transactionSignature}?cluster=devnet`;
          explorerLink.target = '_blank';
          explorerLink.textContent = 'View in Explorer';
          explorerLink.style.color = '#8b5cf6';
          explorerLink.style.textDecoration = 'underline';
          explorerLink.style.cursor = 'pointer';
          this.resultText.appendChild(explorerLink);
        }
        
        this.isSpinning = false;
        const dailySpinButton = document.querySelector('.spin-button-daily') as HTMLButtonElement | null;
        const unlimitedSpinButton = document.querySelector('.spin-button-unlimited') as HTMLButtonElement | null;
        if (dailySpinButton) dailySpinButton.disabled = false;
        if (unlimitedSpinButton) unlimitedSpinButton.disabled = false;
        if (this.claimButton) this.claimButton.disabled = false;

        // Update spin limit display
        this.checkSpinLimit();

        this.resultText.style.background = 'rgba(16, 185, 129, 0.2)';
        this.resultText.style.borderColor = 'rgba(16, 185, 129, 0.5)';

        setTimeout(() => {
          this.resultText.style.background = 'rgba(139, 92, 246, 0.1)';
          this.resultText.style.borderColor = 'rgba(139, 92, 246, 0.3)';
        }, 3000);

        // Save game data and update leaderboard (only if this spin counts)
        if (countToLeaderboard) {
          console.log(`[Game] Saving game data: credits=${this.playerCredits}, wallet=${this.wallet?.publicKey?.toString()}`);
          // Await the save to ensure it completes
          await this.saveGameData().catch((error) => {
            console.error('[Game] Error saving game data:', error);
          });
          await this.updateLeaderboard().catch((error) => {
            console.error('[Game] Error updating leaderboard:', error);
          });
        } else {
          // For unlimited spins, don't save to database or update leaderboard
          console.log('Practice spin - not saving to leaderboard');
        }
        
      } catch (error) {
        console.error('Error handling result:', error);
        this.isSpinning = false;
        this.updateDisplay();
      }
    }
  
    applyResult(result, countToLeaderboard: boolean = true) {
      // Practice spins (unlimited) should NOT affect credit balance at all
      // Only daily spins (rate limited) should affect credits and leaderboard
      if (!countToLeaderboard) {
        // For practice spins, just show the result but don't update credits
        console.log(`Practice spin result: ${result} - Credits unchanged (practice mode)`);
        this.resultText.textContent = `Practice: ${result} (Credits unchanged)`;
        setTimeout(() => {
          this.resultText.style.background = 'rgba(139, 92, 246, 0.1)';
          this.resultText.style.borderColor = 'rgba(139, 92, 246, 0.3)';
        }, 3000);
        return;
      }

      // Only daily spins affect credits
      let pointsChange = 0;
      let message = '';

      if (result.includes('x')) {
        // Multiplier format: 2x, 3x, 0.5x, -0.6x
        const multiplier = parseFloat(result);
        
        if (multiplier > 0) {
          // Positive multipliers: add percentage of current balance
          // e.g., 0.5x on 100 credits = 100 + 50 = 150
          // e.g., 2x on 100 credits = 100 + 200 = 300
          pointsChange = this.playerCredits * multiplier;
          this.playerCredits += pointsChange;
          message = `Added ${multiplier * 100}% of credits!`;
        } else {
          // Negative multipliers: subtract percentage of current balance
          // e.g., -0.6x on 100 credits = 100 - 60 = 40
          const deductMultiplier = Math.abs(multiplier);
          pointsChange = -(this.playerCredits * deductMultiplier);
          this.playerCredits += pointsChange; // pointsChange is negative
          message = `Lost ${deductMultiplier * 100}% of credits!`;
        }
      } else if (result.includes('%')) {
        // Percentage format: 30%, -20%, -50%, -80%
        const percentage = parseFloat(result);
        
        if (percentage > 0) {
          // Positive percentage: add percentage of current balance
          // e.g., 30% on 100 credits = 100 + 30 = 130
        pointsChange = this.playerCredits * (percentage / 100);
        this.playerCredits += pointsChange;
          message = `Added ${percentage}% of credits!`;
      } else {
          // Negative percentage: subtract percentage of current balance
          // e.g., -50% on 100 credits = 100 - 50 = 50
          const deductPercentage = Math.abs(percentage);
          pointsChange = -(this.playerCredits * (deductPercentage / 100));
          this.playerCredits += pointsChange; // pointsChange is negative
          message = `Lost ${deductPercentage}% of credits!`;
        }
      } else {
        // Handle flat numeric adjustments (if any)
        const amount = parseFloat(result);
        if (!isNaN(amount)) {
          pointsChange = amount;
          this.playerCredits += amount;
          message = `${amount >= 0 ? 'Added' : 'Lost'} ${Math.abs(amount)} credits!`;
        }
      }

      this.playerCredits = Math.max(0, Math.round(this.playerCredits));
      this.animatePointsChange(pointsChange);
      this.updateDisplay();

      console.log(`Applied ${result}: Change = ${pointsChange.toFixed(0)}, New Balance = ${this.playerCredits}, Counts to leaderboard: ${countToLeaderboard}`);

      // Note: Leaderboard update happens in handleArciumSpinResult, not here
      // This ensures only daily spins update the leaderboard

      setTimeout(() => {
        this.resultText.style.background = 'rgba(139, 92, 246, 0.1)';
        this.resultText.style.borderColor = 'rgba(139, 92, 246, 0.3)';
      }, 3000);
    }
  
    animatePointsChange(change) {
      if (!this.pointsValue) return;
      const startValue = parseInt(this.pointsValue.textContent);
      const endValue = this.playerCredits;
      const duration = 1000;
      const startTime = performance.now();
  
      const animate = (currentTime) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeOutQuart = 1 - Math.pow(1 - progress, 4);
        const currentValue = Math.floor(startValue + (endValue - startValue) * easeOutQuart);
  
        this.pointsValue.textContent = currentValue.toLocaleString();
  
        if (change > 0) {
          this.pointsValue.style.color = '#10b981';
          this.pointsValue.style.textShadow = '0 0 10px rgba(16, 185, 129, 0.5)';
        } else if (change < 0) {
          this.pointsValue.style.color = '#ef4444';
          this.pointsValue.style.textShadow = '0 0 10px rgba(239, 68, 68, 0.5)';
        }
  
        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          setTimeout(() => {
            this.pointsValue.style.color = '#ffffff';
            this.pointsValue.style.textShadow = '0 0 5px rgba(139, 92, 246, 0.5)';
          }, 500);
        }
      };
  
      requestAnimationFrame(animate);
    }
  
    async claimBasePoints() {
      // Check wallet connection first
      if (this.walletAddress.textContent === 'Not connected' || !this.wallet) {
        this.showError('Please connect your wallet to claim credits');
        return;
      }

      if (!this.canClaim()) {
        const timeLeft = this.getTimeUntilNextClaim();
        this.showError(`You can claim again in ${timeLeft}`);
        return;
      }
  
      const basePoints = 100;
      this.playerCredits += basePoints;
      this.lastClaimTime = Date.now();
      
      this.animatePointsChange(basePoints);
      this.updateDisplay();
      console.log(`[Game] Claiming credits: new balance=${this.playerCredits}`);
      // Await the save to ensure it completes
      await this.saveGameData().catch((error) => {
        console.error('[Game] Error saving after claim:', error);
      });
      await this.updateLeaderboard().catch((error) => {
        console.error('[Game] Error updating leaderboard after claim:', error);
      });
      this.checkClaimCooldown();
  
      this.showSuccess(`Claimed ${basePoints} base credits!`);
    }
  
    canClaim() {
      if (!this.lastClaimTime) return true;
      const now = Date.now();
      const timeSinceLastClaim = now - this.lastClaimTime;
      const cooldownPeriod = 24 * 60 * 60 * 1000;
      return timeSinceLastClaim >= cooldownPeriod;
    }
  
    getTimeUntilNextClaim() {
      if (!this.lastClaimTime) return '0 seconds';
      const now = Date.now();
      const timeSinceLastClaim = now - this.lastClaimTime;
      const cooldownPeriod = 24 * 60 * 60 * 1000;
      const timeLeft = cooldownPeriod - timeSinceLastClaim;
  
      if (timeLeft <= 0) return '0 seconds';
      const hours = Math.floor(timeLeft / (60 * 60 * 1000));
      const minutes = Math.floor((timeLeft % (60 * 60 * 1000)) / (60 * 1000));
      const seconds = Math.floor((timeLeft % (60 * 1000)) / 1000);
      return `${hours}h ${minutes}m ${seconds}s`;
    }
  
    checkClaimCooldown() {
      if (this.canClaim()) {
        this.claimButton.disabled = false;
        this.claimButton.textContent = 'Claim Credits';
      } else {
        this.claimButton.disabled = true;
        const timeLeft = this.getTimeUntilNextClaim();
        this.claimButton.textContent = `Next claim in ${timeLeft}`;
      }
    }
  
    checkSpinLimit() {
      const todayUTC = getUTCDateString();
      if (this.lastSpinResetDate !== todayUTC) {
        // New day - reset spin count (resets at 12am UTC regardless of usage)
        this.spinsUsedToday = 0;
        this.lastSpinResetDate = todayUTC;
        // Save the reset immediately
        this.saveGameData().catch(console.error);
      }
  
      // Update daily spin button state
      const dailySpinButton = document.querySelector('.spin-button-daily') as HTMLButtonElement | null;
      const unlimitedSpinButton = document.querySelector('.spin-button-unlimited') as HTMLButtonElement | null;
      
      if (dailySpinButton) {
        const spinsLeft = this.spinsPerDay - this.spinsUsedToday;
        if (spinsLeft <= 0) {
          dailySpinButton.disabled = true;
          dailySpinButton.textContent = 'Daily Limit Reached';
        } else {
          dailySpinButton.disabled = false;
          dailySpinButton.textContent = `Spin (Daily) - ${spinsLeft} left`;
        }
      }
      
      if (unlimitedSpinButton) {
        unlimitedSpinButton.disabled = false;
        unlimitedSpinButton.textContent = 'Spin (Practice)';
      }
  
      this.updateDisplay();
    }

    /**
     * Check for weekly credit reset (every Saturday at 12am UTC)
     * This is called on the client side, but the actual reset happens server-side via API
     */
    async checkWeeklyReset() {
      try {
        // Check if it's Saturday and past 12am UTC
        const now = new Date();
        const utcDay = now.getUTCDay(); // 0 = Sunday, 6 = Saturday
        const utcHour = now.getUTCHours();
        
        // Check if it's Saturday (6) and after midnight UTC
        if (utcDay === 6 && utcHour >= 0) {
          // Check last reset time from localStorage
          const lastResetKey = 'lastWeeklyReset';
          const lastReset = localStorage.getItem(lastResetKey);
          const lastResetDate = lastReset ? new Date(lastReset) : null;
          
          // Reset if we haven't reset this week yet
          const thisWeek = new Date(now);
          thisWeek.setUTCDate(now.getUTCDate() - utcDay); // Get start of week (Sunday)
          thisWeek.setUTCHours(0, 0, 0, 0);
          
          if (!lastResetDate || lastResetDate < thisWeek) {
            // Call API to reset credits (server-side handles the actual reset)
            try {
              await fetch('/api/player/reset-weekly', { method: 'POST' });
              localStorage.setItem(lastResetKey, now.toISOString());
              console.log('Weekly reset checked');
            } catch (error) {
              console.error('Error calling weekly reset API:', error);
            }
          }
        }
      } catch (error) {
        console.error('Error checking weekly reset:', error);
      }
    }
  
    updateDisplay() {
      if (this.pointsValue) {
        this.pointsValue.textContent = this.playerCredits.toLocaleString();
      }
      const spinLimitValue = document.querySelector('.spin-limit-value');
      if (spinLimitValue) {
        const todayUTC = getUTCDateString();
        if (this.lastSpinResetDate !== todayUTC) {
          // New day - reset spin count (resets at 12am UTC regardless of usage)
          this.spinsUsedToday = 0;
          this.lastSpinResetDate = todayUTC;
          // Save the reset immediately
          this.saveGameData().catch(console.error);
        }
        const spinsLeft = this.spinsPerDay - this.spinsUsedToday;
        spinLimitValue.textContent = `${this.spinsUsedToday}/${this.spinsPerDay}`;
      }
    }
  
    /**
     * Load and display leaderboard (shows all players, synced across all users)
     */
    async loadAndDisplayLeaderboard() {
      try {
        const response = await fetch('/api/leaderboard?limit=10');
        
        if (!response.ok) {
          throw new Error('Failed to fetch leaderboard');
        }
        
        const data = await response.json();
        
        if (data.leaderboard) {
          this.fullLeaderboard = data.leaderboard;
          this.renderLeaderboard(data.leaderboard);
        } else {
          this.fullLeaderboard = [];
          this.renderLeaderboard([]);
        }
      } catch (error) {
        console.error('Error loading leaderboard:', error);
        this.fullLeaderboard = [];
        this.renderLeaderboard([]);
      }
    }

    async updateLeaderboard() {
      await this.loadAndDisplayLeaderboard();
    }
  
    renderLeaderboard(leaderboard) {
      if (this.leaderboardList) {
        if (!leaderboard || leaderboard.length === 0) {
          this.leaderboardList.innerHTML = `
            <li class="leaderboard-item">
              <span class="player-name">No players yet</span>
            </li>
          `;
          return;
        }

        // Render leaderboard entries
        this.leaderboardList.innerHTML = leaderboard.map((entry, index) => {
          const isCurrentPlayer = this.wallet?.publicKey?.toString() === entry.walletAddress;
          const highlightClass = isCurrentPlayer ? 'current-player' : '';
          
          return `
            <li class="leaderboard-item ${highlightClass}">
              <span class="leaderboard-rank">#${entry.rank}</span>
              <span class="player-name">${entry.username}</span>
              <span class="player-credits">${entry.credits.toLocaleString()}</span>
            </li>
          `;
        }).join('');
      }
    }

    async searchLeaderboard(searchTerm: string) {
      if (!searchTerm || !searchTerm.trim()) {
        // If no search term, show regular top 10
        await this.loadAndDisplayLeaderboard();
        return;
      }
      
      try {
        const response = await fetch(`/api/leaderboard?limit=100&search=${encodeURIComponent(searchTerm.trim())}`);
        
        if (!response.ok) {
          throw new Error('Failed to search leaderboard');
        }
        
        const data = await response.json();
        
        if (data.leaderboard) {
          this.renderLeaderboard(data.leaderboard);
        } else {
      this.renderLeaderboard([]);
        }
      } catch (error) {
        console.error('Error searching leaderboard:', error);
        this.renderLeaderboard([]);
      }
    }
  
  
    showSuccess(message) {
      this.resultText.textContent = message;
      this.resultText.style.background = 'rgba(16, 185, 129, 0.2)';
      this.resultText.style.borderColor = 'rgba(16, 185, 129, 0.5)';
      setTimeout(() => {
        this.resultText.style.background = 'rgba(139, 92, 246, 0.1)';
        this.resultText.style.borderColor = 'rgba(139, 92, 246, 0.3)';
      }, 3000);
    }
  
    showError(message) {
      this.resultText.textContent = 'Error: ' + message;
      this.resultText.style.background = 'rgba(239, 68, 68, 0.2)';
      this.resultText.style.borderColor = 'rgba(239, 68, 68, 0.5)';
      setTimeout(() => {
        this.resultText.style.background = 'rgba(139, 92, 246, 0.1)';
        this.resultText.style.borderColor = 'rgba(139, 92, 246, 0.3)';
      }, 5000);
    }
  
    showInfo(message) {
      this.resultText.textContent = message;
      this.resultText.style.background = 'rgba(59, 130, 246, 0.2)';
      this.resultText.style.borderColor = 'rgba(59, 130, 246, 0.5)';
      setTimeout(() => {
        this.resultText.style.background = 'rgba(139, 92, 246, 0.1)';
        this.resultText.style.borderColor = 'rgba(139, 92, 246, 0.3)';
      }, 3000);
    }
  
    loadGameData() {
      // Don't load data until wallet is connected
      // Data will be loaded in initializePlayerAccount()
      this.playerCredits = 0;
      this.playerName = ''; // No name until wallet connects
      this.lastClaimTime = null;
      this.spinsUsedToday = 0;
      this.lastSpinResetDate = null;
    }
  
    async saveGameData() {
      // Don't save if wallet is not connected
      if (this.walletAddress.textContent === 'Not connected' || !this.wallet?.publicKey) {
        console.warn('[Game] Cannot save: wallet not connected');
        return;
      }

      try {
        const walletAddress = this.wallet.publicKey.toString();
        const saveData = {
            walletAddress: walletAddress,
            username: this.playerName,
            credits: this.playerCredits,
          spinsLeft: this.spinsPerDay - this.spinsUsedToday,
            claimTime: this.lastClaimTime,
        };

        console.log(`[Game] Saving player data:`, saveData);

        // Save player data to API (API now auto-updates leaderboard)
        const response = await fetch('/api/player', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(saveData),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[Game] Save failed: ${response.status}`, errorText);
          throw new Error(`Failed to save player data: ${response.status} ${errorText}`);
        }

        const result = await response.json();
        console.log(`[Game] Player data saved successfully:`, result);
        
        // Verify the saved data matches what we sent
        if (result.player) {
          if (result.player.credits !== this.playerCredits) {
            console.warn(`[Game] Credits mismatch! Sent: ${this.playerCredits}, Saved: ${result.player.credits}`);
          }
          if (result.player.username !== this.playerName) {
            console.warn(`[Game] Username mismatch! Sent: ${this.playerName}, Saved: ${result.player.username}`);
          }
        }
        
        // Note: Leaderboard is auto-updated by the player API, no need for separate call

        console.log('[Game] Game data saved successfully');
      } catch (error) {
        console.error('[Game] Error saving game data:', error);
        // Show error to user
        this.showError('Failed to save progress. Please try again.');
        // Don't throw - allow game to continue even if save fails
      }
    }
  
  }
  
  // Export for use in index.tsx
  export default SpinningWheelGame;
