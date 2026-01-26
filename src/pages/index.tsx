import { useEffect, useRef, useState } from 'react';
import { useWallet, useConnection, useAnchorWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import dynamic from 'next/dynamic';
import SpinningWheelGame from '@/game';
import { SystemProgram, Transaction } from '@solana/web3.js';
import { ClientOnly } from '@/components/ClientOnly';

// Dynamically import WalletMultiButton to prevent SSR hydration issues
const DynamicWalletMultiButton = dynamic(
	async () => (await import('@solana/wallet-adapter-react-ui')).WalletMultiButton,
	{
		ssr: false,
		loading: () => (
			<button className="wallet-adapter-button wallet-adapter-button-trigger" disabled>
				Loading...
			</button>
		)
	}
);

const Home = () => {
	const gameRef = useRef<SpinningWheelGame | null>(null);
	const { connection } = useConnection();
	const { publicKey, sendTransaction } = useWallet();
	const anchorWallet = useAnchorWallet(); // Anchor-compatible wallet
	const [isProfileOpen, setIsProfileOpen] = useState(false);
	const [username, setUsername] = useState('');
	const [isClient, setIsClient] = useState(false);


	// Ensure client-side rendering to prevent hydration mismatch
	useEffect(() => {
		setIsClient(true);
		// Don't load username until wallet is connected
		// Username will be set when wallet connects
	}, []);

	useEffect(() => {
		// Only initialize game on client side to prevent hydration issues
		if (!isClient) return;
		
		// Wait for DOM to be fully ready
		const initializeGame = () => {
			// Set wallet first before initializing game
			if (anchorWallet) {
				(window as any)['wallet'] = anchorWallet;
			}
			
			// Reuse existing instance if already initialized (guards StrictMode double-mount)
			if (window.game) {
				gameRef.current = window.game;
			} else {
				console.log('Initializing SpinningWheelGame...');
				gameRef.current = new SpinningWheelGame();
				window.game = gameRef.current;
				window.__WHEEL_GAME_INITIALIZED__ = true;
			}

			// Dispatch initial wallet status on mount
			window.dispatchEvent(
				new CustomEvent('wallet-connected', {
					detail: { publicKey: publicKey ? publicKey : null, wallet: anchorWallet }
				})
			);

			window.updatePointsDisplay = (points: number) => {
				const pointsElement = document.querySelector('.points-value');
				if (pointsElement) {
					pointsElement.textContent = points.toLocaleString();
				}
			};

			// Bind DOM listeners only once per page lifecycle
			if (!window.__WHEEL_LISTENERS_BOUND__) {
				const searchInput = document.querySelector('.leaderboard-search input') as HTMLInputElement | null;
				const searchClear = document.querySelector('.search-clear');
				if (searchInput && searchClear) {
					searchInput.addEventListener('input', (e) => {
						const searchTerm = (e.target as HTMLInputElement).value.trim();
						searchClear.classList.toggle('visible', !!searchTerm);
						if (gameRef.current) {
							if (searchTerm) {
								gameRef.current.searchLeaderboard(searchTerm);
							} else {
								gameRef.current.renderLeaderboard(gameRef.current.fullLeaderboard);
							}
						}
					});

					searchClear.addEventListener('click', () => {
						(searchInput as HTMLInputElement).value = '';
						searchClear.classList.remove('visible');
						if (gameRef.current) {
							gameRef.current.renderLeaderboard(gameRef.current.fullLeaderboard);
						}
					});
				}

				document.addEventListener('keydown', (e) => {
					if (e.ctrlKey && e.key === 'f') {
						e.preventDefault();
						if (searchInput) searchInput.focus();
					}
				});

				window.__WHEEL_LISTENERS_BOUND__ = true;
			}
		};

		// Use setTimeout to ensure DOM is ready
		setTimeout(initializeGame, 100);

		// Also add a DOM ready check for wheel labels
		const checkWheelLabels = () => {
			const wheelLabelsContainer = document.querySelector('.wheel-labels');
			if (wheelLabelsContainer && gameRef.current) {
				console.log('Wheel labels container found, drawing wheel...');
				gameRef.current.drawWheel();
			} else {
				console.log('Wheel labels container not found, retrying...');
				setTimeout(checkWheelLabels, 200);
			}
		};

		// Check for wheel labels after a short delay
		setTimeout(checkWheelLabels, 300);

		return () => {
			// Intentionally left blank; listeners are bound to a single instance and guarded globally
		};
	}, [isClient, publicKey, anchorWallet]);

	// Notify game of wallet changes without recreating the game instance
	useEffect(() => {
		// Store Anchor-compatible wallet reference globally for game access
		if (anchorWallet) {
			(window as any)['wallet'] = anchorWallet;
		} else {
			(window as any)['wallet'] = null;
		}
		
		window.dispatchEvent(
			new CustomEvent('wallet-connected', {
				detail: { publicKey: publicKey ? publicKey : null, wallet: anchorWallet }
			})
		);
	}, [publicKey, anchorWallet]);

	// Update username when wallet connects/disconnects or when player data is loaded
	useEffect(() => {
		if (publicKey && anchorWallet) {
			// Wait for game to load player data from API, then update React state
			const handlePlayerDataLoaded = (event: CustomEvent) => {
				if (event.detail?.username) {
					setUsername(event.detail.username);
				}
			};
			
			window.addEventListener('player-data-loaded', handlePlayerDataLoaded as EventListener);
			
			// Fallback: if game already loaded, get username from game instance
			if (gameRef.current && gameRef.current.playerName) {
				setUsername(gameRef.current.playerName);
			}
			
			return () => {
				window.removeEventListener('player-data-loaded', handlePlayerDataLoaded as EventListener);
			};
		} else {
			setUsername('');
			if (gameRef.current) {
				gameRef.current.playerName = '';
			}
		}
	}, [publicKey, anchorWallet]);

	// Expose a minimal-fee devnet transaction for spins
	useEffect(() => {
		// Define once; update captured refs via params
		window.requestSpinTransaction = async () => {
			if (!publicKey) throw new Error('Wallet not connected');
			if (window.__SPIN_TX_IN_FLIGHT__) return; // guard against double calls
			window.__SPIN_TX_IN_FLIGHT__ = true;
			try {
				// 1-lamport self-transfer to incur minimal network fee
				const ix = SystemProgram.transfer({ fromPubkey: publicKey, toPubkey: publicKey, lamports: 1 });
				const latest = await connection.getLatestBlockhash();
				const tx = new Transaction({ feePayer: publicKey, recentBlockhash: latest.blockhash }).add(ix);
				const sig = await sendTransaction(tx, connection);
				await connection.confirmTransaction({ signature: sig, ...latest }, 'confirmed');
				console.log('Spin transaction confirmed:', sig);
			} catch (error) {
				console.error('Spin transaction failed:', error);
				throw error;
			} finally {
				window.__SPIN_TX_IN_FLIGHT__ = false;
			}
		};
	}, [publicKey, connection, sendTransaction]);

	const toggleProfile = () => {
		setIsProfileOpen(!isProfileOpen);
	};

	const saveUsername = async () => {
		// Check wallet connection first
		if (!publicKey || !anchorWallet) {
			alert('Please connect your wallet first');
			return;
		}

		const input = document.querySelector('.username-input') as HTMLInputElement;
		const username = input?.value.trim();
		if (username) {
			setUsername(username);
			if (gameRef.current) {
				gameRef.current.playerName = username;
				await gameRef.current.saveGameData();
				await gameRef.current.updateLeaderboard();
			}
			setIsProfileOpen(false);
		}
	};

	const onAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;
		const reader = new FileReader();
		reader.onload = () => {
			try {
				const dataUrl = reader.result as string;
				localStorage.setItem('wheelGameAvatar', dataUrl);
				const imgEl = document.querySelector('.profile-avatar') as HTMLDivElement | null;
				if (imgEl) {
					imgEl.style.backgroundImage = `url(${dataUrl})`;
					imgEl.textContent = '';
				}
			} catch {}
		};
		reader.readAsDataURL(file);
	};

	useEffect(() => {
		if (!isClient) return;
		
		const savedAvatar = localStorage.getItem('wheelGameAvatar');
		const imgEl = document.querySelector('.profile-avatar') as HTMLDivElement | null;
		if (savedAvatar && imgEl) {
			imgEl.style.backgroundImage = `url(${savedAvatar})`;
			imgEl.textContent = '';
		}
	}, [isClient]);

	return (
		<div className="main-layout">
			<div className="left-panel">
				<ClientOnly fallback={
					<div className="profile-section">
						<div className="profile-header">
							<div className="profile-avatar">?</div>
							<div className="profile-info">
								<h3>Connect Wallet</h3>
								<p>Connect wallet to get started</p>
							</div>
						</div>
						<div className="points-display">
							<p className="points-label">Your Credits:</p>
							<p className="points-value">0</p>
						</div>
						<div className="spin-limit-display">
							<p className="spin-limit-label">Daily Spins:</p>
							<p className="spin-limit-value">30/30</p>
						</div>
					</div>
				}>
					<div className="profile-section">
						<div className="profile-header" onClick={toggleProfile}>
							<div className="profile-avatar">
								{isClient && username ? (username[0]?.toUpperCase() || '?') : '?'}
							</div>
							<div className="profile-info">
								<h3>{isClient && username ? username : 'Connect Wallet'}</h3>
								<p>{isClient && username ? 'Click to manage your username' : 'Connect wallet to get started'}</p>
							</div>
						</div>
						<div className={`profile-details ${isProfileOpen ? 'active' : ''}`}>
							<input
								type="text"
								className="username-input"
								placeholder="Enter your username"
								defaultValue={username}
							/>
							<label className="avatar-upload">
								<input type="file" accept="image/*" onChange={onAvatarChange} />
								Upload Avatar
							</label>
							<button className="save-username-btn" onClick={saveUsername}>
								Save Username
							</button>
						</div>
						<div className="points-display">
							<p className="points-label">Your Credits:</p>
							<p className="points-value">0</p>
						</div>
						<div className="spin-limit-display">
							<p className="spin-limit-label">Daily Spins:</p>
							<p className="spin-limit-value">30/30</p>
						</div>
					</div>
				</ClientOnly>
				<ClientOnly fallback={<button className="wallet-adapter-button wallet-adapter-button-trigger" disabled>Loading...</button>}>
					<DynamicWalletMultiButton />
				</ClientOnly>
				<div className="arcium-description">
					<h3>About Arcium</h3>
					<p>This is a demonstration of Arcium&apos;s confidential computing ability, through the private-randomisation of the wheel number outcomes.</p>
					<p>What is Arcium? Arcium is the encrypted super computer, privacy can be added to any application.</p>
				</div>
			</div>
			<div id="game-container">
				<h1 className="game-title">Encrypted Wheel</h1>
				<div className="wheel-container">
					<canvas id="wheelCanvas" width={400} height={400}></canvas>
					<div className="wheel-labels"></div>
					<div className="wheel-center"></div>
				</div>
				<div className="controls">
					<button 
						className="claim-button" 
						onClick={async (e) => {
							e.preventDefault();
							console.log('Claim button clicked via React!');
							if (gameRef.current) {
								await gameRef.current.claimBasePoints();
							} else if ((window as any).handleClaimClick) {
								await (window as any).handleClaimClick();
							}
						}}
					>
						Claim Credits
					</button>
					<button 
						className="spin-button-daily"
						onClick={async (e) => {
							e.preventDefault();
							console.log('Daily spin button clicked via React!');
							if (gameRef.current) {
								await gameRef.current.spinWheelDaily();
							} else if ((window as any).handleDailySpinClick) {
								await (window as any).handleDailySpinClick();
							}
						}}
					>
						Spin (Daily)
					</button>
					<button 
						className="spin-button-unlimited"
						onClick={async (e) => {
							e.preventDefault();
							console.log('Unlimited spin button clicked via React!');
							if (gameRef.current) {
								await gameRef.current.spinWheelUnlimited();
							} else if ((window as any).handleUnlimitedSpinClick) {
								await (window as any).handleUnlimitedSpinClick();
							}
						}}
					>
						Spin (Practice)
					</button>
				</div>
				<div className={`result-text ${publicKey ? 'wallet-connected' : ''}`}>
					{publicKey ? `Welcome! Wallet connected: ${publicKey.toString().slice(0, 8)}...` : 'Connect your wallet to start playing!'}
				</div>
				<div className="leaderboard-section">
					<h2>Leaderboard</h2>
					<p className="leaderboard-reset-info">Weekly rankings/credits resets every Saturday</p>
					<div className="leaderboard-search">
						<input type="text" placeholder="Search players..." />
						<button className="search-clear">X</button>
					</div>
					<ul className="leaderboard-list">
						<li>Loading leaderboard...</li>
					</ul>
				</div>
			</div>
			<div className="glow-orb"></div>
			<div className="glow-orb"></div>
			<div className="glow-orb"></div>
		</div>
	);
};

export default Home;