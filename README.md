# No-Calc Trainer MVP

This is a streamlined MVP version of the No-Calc Trainer application, focusing on core practice and assessment features.

## Included Sections

### Overview (`/`)
- Homepage with activity calendar
- Quick navigation to key sections
- Activity heatmap showing practice history

### Past Papers (`/past-papers/*`)
- **Library** (`/past-papers/library`): Paper session setup wizard
- **Solve** (`/past-papers/solve`): Timed paper-taking interface
- **Mark** (`/past-papers/mark`): Review and marking interface
- **Analytics** (`/past-papers/analytics`): Performance analytics (placeholder for now)
- **Drill** (`/past-papers/drill`): Spaced repetition drill mode for paper questions

### Train (`/train/*`)
- **Drill** (`/train/drill`): Custom multi-topic session builder
- **Analytics** (`/train/analytics`): Performance analytics with Personal/Global views

## Excluded Sections

The following sections are **intentionally excluded** from this MVP:

- **Learn** (`/train/learn`): Topic tutorials and lessons
- **Interview** (`/interview/*`): Interview preparation features

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Supabase project with database configured

### Installation

```bash
npm install
```

### Environment Variables

Create a `.env.local` file with:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Stripe (for subscriptions)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Stripe Price IDs (create in Dashboard)
STRIPE_PRICE_WEEKLY=price_...
STRIPE_PRICE_MONTHLY=price_...
STRIPE_PRICE_SEASON_74=price_...
STRIPE_PRICE_SEASON_84=price_...
STRIPE_PRICE_SEASON_94=price_...
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build

```bash
npm run build
npm start
```

## Project Structure

```
nocalcMVP2_real/
├── src/                    # Application source code
│   ├── app/                # Next.js app router pages
│   ├── components/         # React components
│   ├── lib/                # Utility libraries
│   ├── store/              # Zustand state stores
│   ├── types/              # TypeScript type definitions
│   └── config/             # Configuration files
├── scripts/                # Scripts and utilities
│   ├── utilities/          # One-off Python scripts (migrations, fixes)
│   ├── backup/             # Database backup scripts
│   ├── esat_question_generator/  # ESAT question generation tools
│   ├── tmua_question_generator/  # TMUA question generation tools
│   └── schema_generator/   # Schema extraction and analysis tools
├── docs/                   # Documentation
│   ├── guides/             # Active documentation (deployment, security, config)
│   └── archive/            # Historical documentation
├── examples/               # Example files and code samples
├── supabase/               # Supabase configuration
│   └── migrations/         # Database migrations
└── public/                 # Static assets
```

## Key Features

- **Paper Practice**: Full paper-taking workflow from planning to marking
- **Drill Sessions**: Custom multi-topic practice sessions
- **Analytics**: Performance tracking and insights
- **Activity Tracking**: Visual calendar showing practice history
- **Spaced Repetition**: Drill mode for reviewing difficult questions

## Documentation

- **[Documentation Index](docs/README.md)** - Overview of all documentation
- **[Stripe Setup](docs/STRIPE_SETUP.md)** - Payment integration, subscriptions, and setup
- **[Deployment Guide](docs/guides/DEPLOYMENT_GUIDE.md)** - How to deploy the application
- **[Security Guide](docs/guides/SECURITY_HANDOVER_GUIDE.md)** - Security best practices
- **[Configuration Guides](docs/guides/)** - Colors, branding, and other configurations

## Scripts & Utilities

- **[Utility Scripts](scripts/utilities/README.md)** - One-off Python scripts for migrations and fixes
- **[Backup Scripts](scripts/backup/)** - Database backup utilities

## Recent Fixes

### Authentication (Login/Logout)
- **Fixed logout functionality**: Improved logout flow to properly clear session state and handle errors. Logout now waits for signOut to complete and uses a hard redirect to ensure all session data is cleared.
- **Fixed login state detection**: Enhanced login page to check session state directly from Supabase, preventing issues where users couldn't login when already logged out due to stale session state.
- **Improved error handling**: Added comprehensive error handling throughout the authentication flow for better reliability.

## Notes

- The Papers Analytics page is currently a placeholder with mock data
- All Learn and Interview routes have been removed
- Navigation has been simplified to only show Overview, Papers, and Train sections

