# NoFeeSwap Full-Stack Web3 Assignment

> **Senior Full-Stack Web3 Engineer — Technical Assessment Submission**

---

## Transparency Statement

| Task | Status | Notes |
|---|---|---|
| Task 1 – Protocol Deployment (Anvil + Core + Operator) | ✅ Complete | Foundry Anvil, deploy scripts for core & operator, mock ERC-20s |
| Task 2a – Wallet Integration (MetaMask) | ✅ Complete | wagmi v2 + viem, pending/confirmed/reverted states |
| Task 2b – Initialize Pool (with Kernel UI) | ✅ Complete | Graphical kernel editor (drag control points), mock kernel fallback |
| Task 2c – Manage Liquidity (Mint/Burn) | ✅ Complete | Visual position display, partial/full withdrawal |
| Task 2d – Swap Interface | ✅ Complete | Slippage control, estimated output, price impact |
| Task 3a – Mempool Monitoring | ✅ Complete | ethers.js pending tx subscription on non-mining Anvil |
| Task 3b – Calldata Decoding | ✅ Complete | ABI-decodes swap calldata, extracts slippage + size |
| Task 3c – Sandwich Execution | ✅ Complete | Front-run / victim / back-run with nonce + gas ordering |

**Known Limitations** — see [Known Limitations](#known-limitations) section below.

---

## Prerequisites

| Tool | Version | Install |
|---|---|---|
| Foundry (forge + anvil + cast) | ≥ 0.2.0 | `curl -L https://foundry.paradigm.xyz \| bash && foundryup` |
| Node.js | ≥ 20 LTS | https://nodejs.org |
| pnpm | ≥ 9 | `npm i -g pnpm` |
| Git | any | OS package manager |
| MetaMask | latest | Chrome extension |

> **Python 3.12 + pip** are only needed if you want to run the upstream NoFeeSwap Python test suite. The deployment scripts in this repo use Foundry/TypeScript exclusively.

---

## Repository Structure

```
nofeeswap-assignment/
├── contracts/              # Solidity contracts + Foundry project
│   ├── src/
│   │   └── mocks/          # MockERC20.sol
│   ├── script/
│   │   ├── DeployCore.s.sol
│   │   ├── DeployOperator.s.sol
│   │   └── DeployMocks.s.sol
│   ├── lib/                # git submodules (core, operator)
│   └── foundry.toml
├── frontend/               # Next.js 14 dApp
│   ├── src/
│   │   ├── components/
│   │   │   ├── wallet/     # ConnectWallet, TxToast
│   │   │   ├── pool/       # InitializePool, KernelEditor
│   │   │   ├── liquidity/  # MintLiquidity, BurnLiquidity, PositionCard
│   │   │   └── swap/       # SwapInterface, SlippageControl
│   │   ├── hooks/          # usePool, useLiquidity, useSwap, useTxStatus
│   │   ├── utils/          # encoding.ts, math.ts, addresses.ts
│   │   └── abis/           # NoFeeSwap ABI JSON files
│   └── package.json
├── bot/                    # Sandwich bot (TypeScript)
│   ├── src/
│   │   ├── monitor.ts      # Mempool subscription
│   │   ├── decoder.ts      # Calldata decoding
│   │   ├── sandwich.ts     # Sandwich execution logic
│   │   └── index.ts        # Entry point
│   └── package.json
└── README.md
```

---

## Step-by-Step Setup

### Step 1 — Clone This Repository & Submodules

```bash
git clone https://github.com/YOUR_USERNAME/nofeeswap-assignment.git
cd nofeeswap-assignment

# Pull NoFeeSwap core and operator as submodules
git submodule update --init --recursive
```

### Step 2 — Install Foundry Dependencies & Compile

```bash
cd contracts
forge install
forge build
```

> If `forge install` fails on submodules, run:
> ```bash
> git submodule add https://github.com/NoFeeSwap/core lib/nofeeswap-core
> git submodule add https://github.com/NoFeeSwap/operator lib/nofeeswap-operator
> forge install OpenZeppelin/openzeppelin-contracts
> ```

### Step 3 — Launch Anvil (No Auto-Mining)

Open a **new terminal** and keep it running:

```bash
anvil \
  --block-time 0 \
  --no-mining \
  --chain-id 31337 \
  --port 8545 \
  --mnemonic "test test test test test test test test test test test junk"
```

> `--no-mining` is critical — transactions stay in the mempool so the sandwich bot can detect them before a block is produced.

The first funded account will be:
- **Address**: `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`
- **Private Key**: `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80`

### Step 4 — Deploy Contracts

In the `contracts/` directory:

```bash
# Set deployer private key
export PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
export RPC_URL=http://127.0.0.1:8545

# Deploy NoFeeSwap Core
forge script script/DeployCore.s.sol:DeployCore \
  --rpc-url $RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast \
  -vvvv

# Deploy NoFeeSwap Operator
forge script script/DeployOperator.s.sol:DeployOperator \
  --rpc-url $RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast \
  -vvvv

# Deploy Mock ERC-20 tokens (ALPHA + BETA) and mint to test wallet
forge script script/DeployMocks.s.sol:DeployMocks \
  --rpc-url $RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast \
  -vvvv
```

After deployment, copy the contract addresses printed in the terminal into:

```
frontend/src/utils/addresses.ts
bot/src/addresses.ts
```

### Step 5 — Configure MetaMask

1. Open MetaMask → **Add Network** → **Add a network manually**:
   - Network Name: `Anvil Local`
   - RPC URL: `http://127.0.0.1:8545`
   - Chain ID: `31337`
   - Currency Symbol: `ETH`
2. Import the test account using the private key above.

### Step 6 — Start the Frontend

```bash
cd frontend
pnpm install
pnpm dev
```

Open **http://localhost:3000** in your browser.

### Step 7 — Start the Sandwich Bot

Open another terminal:

```bash
cd bot
pnpm install
pnpm build
pnpm start
```

The bot will print `[BOT] Monitoring mempool on http://127.0.0.1:8545` and wait.

### Step 8 — Mine Blocks on Demand

Since auto-mining is disabled, mine blocks when needed:

```bash
# Mine a single block
cast rpc anvil_mine 1 --rpc-url http://127.0.0.1:8545

# Or set a shortcut
alias mine='cast rpc anvil_mine 1 --rpc-url http://127.0.0.1:8545'
```

The sandwich bot mines in the correct order automatically during an attack.

---

## Full Workflow Demo

1. Open http://localhost:3000 → **Connect Wallet**
2. Go to **Initialize Pool** → enter token pair, configure kernel shape (drag points), submit
3. Go to **Liquidity** → **Mint** some liquidity to the new pool
4. Bot terminal: `[BOT] Monitoring...`
5. Go to **Swap** → set amount, set slippage (e.g. 2%), click **Swap** — **DO NOT CONFIRM IN METAMASK YET**
6. Watch bot terminal detect the pending tx: `[BOT] Detected victim swap`
7. Confirm the swap in MetaMask
8. Bot executes: front-run → victim tx mines → back-run
9. Bot prints profit/loss report

---

## Architectural Overview

### Frontend

Built with **Next.js 14 (App Router)**, **wagmi v2**, **viem**, and **TailwindCSS**.

- `useSwap` hook constructs calldata for the NoFeeSwap Operator's `swap()` function, encodes slippage as `sqrtPriceLimitX96`, and sends the transaction via MetaMask.
- `KernelEditor` renders an SVG canvas where the user drags Bézier control points. These map to NoFeeSwap's kernel segment breakpoints (`kernelCompact` encoding). As a fallback, a default curve from `SwapData_test.py#L841-L846` is used.
- Transaction status is tracked via wagmi's `useWaitForTransactionReceipt` and shown as a toast (pending → confirmed / reverted).

### Sandwich Bot

```
mempool subscription (eth_subscribe "newPendingTransactions")
         │
         ▼
  fetch tx by hash  ──▶  filter: to == Operator address
         │
         ▼
  decode calldata   ──▶  extract amountIn, sqrtPriceLimitX96 (slippage)
         │
         ▼
  profitability check: estimatedFrontRunOutput - estimatedBackRunInput > GAS_COST
         │
         ▼
  if profitable:
    1. front-run tx  (gasPrice = victim.gasPrice * 1.15, nonce = N)
    2. set anvil_mine 1  (front-run mines first)
    3. victim tx executes  (nonce = N+1 for victim's account)
    4. set anvil_mine 1  (victim mines)
    5. back-run tx  (gasPrice = victim.gasPrice * 0.9, nonce = N+1 for bot)
    6. set anvil_mine 1  (back-run mines)
```

**Profitability Math:**

```
frontRunCost  = amountIn_frontRun
frontRunOut   = getAmountOut(pool, amountIn_frontRun)    // price moves up
victimOut     = getAmountOut(pool, amountIn_victim)       // victim gets worse price
backRunIn     = frontRunOut  (we sell what we bought)
backRunOut    = getAmountOut(pool_after_victim, backRunIn)
profit        = backRunOut - frontRunCost - gasCosts
```

All math uses integer arithmetic (no floating point) matching EVM behaviour.

---

## Known Limitations

1. **Kernel Encoding Complexity**: NoFeeSwap's kernel uses a bespoke binary encoding described in the YellowPaper. The graphical editor maps Bézier handles to kernel breakpoints with a simplified approximation. A production implementation would implement the full `kernelCompact` spec from the YellowPaper §4.
2. **Slippage via `sqrtPriceLimitX96`**: The swap interface uses the standard `sqrtPriceLimitX96` pattern. Exact encoding for NoFeeSwap's curve-based price limit may require additional calibration against the deployed contracts.
3. **Sandwich Profitability on Local Net**: On Anvil with test tokens, slippage will be small and sandwiches may show zero profit. This is expected — the execution logic is correct; profit depends on pool depth and trade size.
4. **No Hook Support**: The pool initialization UI does not expose hook contract addresses. Pools are initialized with `address(0)` for hooks.
5. **No Permit2 / ERC-2612**: Approvals are done via standard `approve()`. Permit2 integration would improve UX.
6. **Bot uses `anvil_mine` RPC**: In a real mempool (e.g. Flashbots), ordering would be enforced by gas/priority fees alone without manual mining. The `anvil_mine` calls simulate the block ordering logic for demonstration.

---

## Environment Variables

Create `frontend/.env.local`:
```
NEXT_PUBLIC_CHAIN_ID=31337
NEXT_PUBLIC_RPC_URL=http://127.0.0.1:8545
NEXT_PUBLIC_NOFEESWAP_CORE=0x...       # from Step 4
NEXT_PUBLIC_NOFEESWAP_OPERATOR=0x...   # from Step 4
NEXT_PUBLIC_TOKEN_ALPHA=0x...          # from Step 4
NEXT_PUBLIC_TOKEN_BETA=0x...           # from Step 4
```

Create `bot/.env`:
```
RPC_URL=http://127.0.0.1:8545
PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
NOFEESWAP_OPERATOR=0x...
TOKEN_ALPHA=0x...
TOKEN_BETA=0x...
```
