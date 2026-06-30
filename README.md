# MunchUp Canteen Manager

MunchUp is a modern, high-performance, mobile-first kiosk and web-app frontend designed for managing campus cafeteria orders, digital wallet balances, and ticket statuses. Built as an installable Progressive Web App (PWA), it integrates advanced features like on-device OCR card scanning for automatic registration, real-time ticket synchronization, and QR-based checkout validation at cafeteria counters.

---

## Key Features

- **Multi-Profile Login:** Save and manage multiple campus profiles on a single device, secured by individual 5-character alphanumeric PINs.
- **On-Device OCR Registration:** Automatic name, ID, and batch extraction from uploaded student/staff ID cards using `tesseract.js` to streamline onboarding.
- **Digital Wallet:** Staged account ledger statements, real-time balance tracking, and offline counter top-up notifications.
- **Dynamic Menu & Cart:** Live cafeteria item listings syncing at 5-second intervals with automated balance shortfall notifications.
- **Instant QR Checkout:** Scan counter validation tags using webcam processing (`jsqr`) to finalize food collections and process payments.
- **Operator Override OTPs:** Fallback validation via Operator-submitted authorization codes (OTPs) for devices with camera issues.
- **PWA Capabilities:** Native-like experience with install banners, offline state detection, and automatic view height scaling.
- **Admin Dashboard:** Real-time metrics tracking user accounts, counter load statuses, and canteen sales analytics.

---

## Technology Stack

- **Framework:** Svelte 5 (utilizing Runes & Snippets) & SvelteKit 2
- **Styling:** TailwindCSS 4 (integrated with Vite)
- **Database ORM:** Drizzle ORM
- **Database Driver:** Postgres (PostgreSQL)
- **Icons:** Lucide Svelte
- **OCR Engine:** Tesseract.js (WebAssembly on-device extraction)
- **QR Scanner:** jsQR (Client webcam image decoder)
- **Notifications:** Pusher & Pusher-js (Live counter updates)

---

## Directory & File Structure

```filename
├── drizzle/                    # Database migrations SQL files
│   ├── custom_sql/             # Extended custom database utilities
│   └── meta/                   # Drizzle migrations schema mapping
├── static/                     # Static public assets
│   └── manifest.webmanifest    # PWA configuration manifest
├── src/
│   ├── app.d.ts                # TypeScript global environment/locals definitions
│   ├── hooks.server.ts         # Authentication guards and session hooks
│   ├── layout.css              # Global styling variables and animations
│   ├── service-worker.ts       # Service worker caching for offline access
│   ├── lib/
│   │   ├── assets/             # Images, favicons, and graphic SVGs
│   │   ├── components/         # Reusable Svelte UI components
│   │   │   ├── DietaryIcon.svelte      # Veg / Non-veg marker badge
│   │   │   ├── SubPageHeader.svelte    # Uniform subpage headers & back navigation
│   │   │   ├── AppLogo.svelte          # Unified campus branding SVG logo
│   │   │   └── CardSkeleton.svelte     # Dashboard loading placeholders
│   │   ├── server/             # Server-only utilities
│   │   │   ├── api.ts          # Authorization handlers and helper guards
│   │   │   ├── auth.ts         # User session creation & validation helpers
│   │   │   └── db/             # Drizzle database schemas and connections
│   │   ├── index.ts            # Exported utility functions (INR formatting, initials, etc.)
│   │   ├── store.svelte.ts     # Global reactive state store using Svelte 5 Runes
│   │   └── types.ts            # Shared TypeScript type definitions
│   └── routes/                 # File-based application routes
│       ├── (admin)/            # Admin routing path group
│       │   └── admin/          # Counters, users verification, and sales graphs
│       ├── (app)/              # Main consumer app routing path group
│       │   ├── menu/           # Food menu selection grid and cart stepper
│       │   ├── orders/         # Completed transaction checkouts history list
│       │   ├── ticket/         # QR ticket scanner interface (webcam)
│       │   ├── topup/          # Wallet balance addition guidelines
│       │   └── profile/        # User accounts details, statements, and security
│       ├── (auth)/             # Login and card registration flows
│       └── api/                # REST endpoints
```

---

## Database Schema Model

Drizzle schemas are defined in `src/lib/server/db/schema.ts` mapping PostgreSQL structures:

1. **`users`**: Contains consumer name, ID, hashed security PIN, dietary options, wallet balance, active role, and card verification status.
2. **`user_sessions`**: Stored user browser auth sessions.
3. **`menu_items`**: Cafeteria listings including descriptions, pricing, dietary status, and stock availability.
4. **`counters`**: Individual collection stalls and hardware state indicators.
5. **`tickets` & `ticket_items`**: Staged checkouts, listing order quantities, unit prices, and fulfillment status (`PENDING`, `READY`, `COMPLETED`, `CANCELLED`).
6. **`wallet_transactions`**: Logs of credits (top-ups) and debits (food collection payments).
7. **`manual_order_otps`**: Stores generated 6-digit confirmation codes for counter operator validation bypasses.

---

## REST API Endpoints

| Route Prefix    | Method | Endpoint / Action      | Description                                       |
| :-------------- | :----- | :--------------------- | :------------------------------------------------ |
| `/api/auth`     | `POST` | `/login`               | Authenticate profile ID and 5-digit PIN           |
|                 | `POST` | `/register`            | Create account with name, ID, and card image URL  |
|                 | `POST` | `/register/sign-image` | Get presigned secure upload URL (Cloudinary / R2) |
|                 | `POST` | `/logout`              | Terminate active user browser session             |
|                 | `POST` | `/logout-devices`      | Terminate all active sessions for current account |
|                 | `POST` | `/pin`                 | Modify security PIN authorization                 |
| `/api/checkout` | `POST` | `/`                    | Execute QR code validated payment transaction     |
|                 | `POST` | `/manual/verify`       | Process manual operators OTP override             |
| `/api/menu`     | `GET`  | `/`                    | Fetch all menu items available in canteen         |
| `/api/orders`   | `GET`  | `/?status=X&limit=Y`   | Paginated list of active/past ticket logs         |
| `/api/wallet`   | `GET`  | `/history`             | Paginated wallet statement transaction log        |
| `/api/admin`    | `GET`  | `/analytics`           | Admin-only cafeteria metrics & sales breakdowns   |

---

## Setup & Running Locally

### Prerequisites

Make sure you have Node.js (v18+) and [pnpm](https://pnpm.io/) installed.

### 1. Environment Configuration

Clone the repository and copy the environment template:

```sh
cp .env.example .env
```

Open `.env` and configure your database connection string:

```env
DATABASE_URL="postgres://username:password@localhost:5432/munchup"
```

### 2. Install Dependencies

```sh
pnpm install
```

### 3. Database Initialisation

Run database migrations to generate the required tables:

```sh
pnpm db:push
```

To preview and manage database tables visually, launch Drizzle Studio:

```sh
pnpm db:studio
```

### 4. Running Dev Server

```sh
pnpm dev
```

The application will be running locally at `http://localhost:5173`.

### 5. Production Compilation

```sh
pnpm run check    # Verify TypeScript types compiles cleanly
pnpm run build    # Compile production client & server bundles
pnpm run preview  # Preview the production build locally
```

---

## AI Use Disclaimer

This project, its components, code layouts, and specific refactoring models have been designed and maintained in collaboration with Google's Antigravity AI coding assistant to ensure structural integrity, type safety, and clean software architecture patterns.
