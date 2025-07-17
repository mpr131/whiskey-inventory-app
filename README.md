# Whiskey Vault - Premium Inventory Management System

A sophisticated whiskey collection management system built with Next.js 14, MongoDB, and NextAuth.js. Features a premium dark theme with glass morphism effects and copper accents.

## Features

- 🔐 **Secure Authentication** with invite code system
- 🥃 **Comprehensive Bottle Management** with custom fields for store picks
- 📍 **Location & Bin Tracking** for organized storage
- 💰 **Value Tracking** with purchase price and current estimates
- 📸 **Image Uploads** via Cloudinary integration
- 🎨 **Premium Design** with dark theme and glass morphism effects
- 📱 **Mobile Responsive** interface

## Tech Stack

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, MongoDB with Mongoose
- **Authentication**: NextAuth.js with credentials provider
- **Image Storage**: Cloudinary
- **Styling**: Tailwind CSS with custom premium theme

## Getting Started

### Prerequisites

- Node.js 18+ 
- MongoDB instance (local or cloud)
- Cloudinary account (for image uploads)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd whiskey-inventory-app
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env.local` file based on `.env.example`:
```bash
cp .env.example .env.local
```

4. Update the environment variables in `.env.local`:
```
MONGODB_URI=mongodb://localhost:27017/whiskey-inventory
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key-here
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

5. Seed the database with an admin user:
```bash
npm run seed
```

This will create:
- Admin user: `admin@whiskeyvault.com` / `admin123`
- Initial invite code: `ADMIN001` (already used by admin)

6. Run the development server:
```bash
npm run dev
```

7. Open [http://localhost:3000](http://localhost:3000) in your browser

## Project Structure

```
whiskey-inventory-app/
├── app/                    # Next.js 14 app directory
│   ├── api/               # API routes
│   ├── auth/              # Authentication pages
│   ├── dashboard/         # Dashboard page
│   └── layout.tsx         # Root layout
├── components/            # React components
├── lib/                   # Utility functions
│   ├── auth.ts           # NextAuth configuration
│   └── mongodb.ts        # MongoDB connection
├── models/               # Mongoose schemas
│   ├── User.ts
│   ├── InviteCode.ts
│   ├── Bottle.ts
│   └── Location.ts
├── scripts/              # Utility scripts
│   └── seed.ts          # Database seeding
└── types/               # TypeScript type definitions
```

## Key Features

### Authentication System
- Secure login with email/password
- Invite code system for new registrations
- Admin users can generate and manage invite codes
- Session-based authentication with JWT

### Bottle Management
- Comprehensive bottle information tracking
- Support for store picks with custom fields
- Image uploads for bottle photos
- Value tracking and rating system
- Open/closed bottle status

### Location Management
- Create storage locations (cabinets, shelves, cellars)
- Bin system for detailed organization
- Temperature and humidity tracking
- Capacity management

## Development

### Running Tests
```bash
npm run test
```

### Building for Production
```bash
npm run build
npm start
```

### Linting
```bash
npm run lint
```

## Deployment

The application can be deployed to any platform that supports Next.js:

- Vercel (recommended)
- Netlify
- AWS Amplify
- Self-hosted with Node.js

Make sure to set all environment variables in your deployment platform.

## License

This project is private and proprietary.

## Support

For support or questions, please contact the development team.