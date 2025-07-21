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

### Rating System
- **Personal Ratings**: Real-time calculation of your average rating per bottle
- **Community Ratings**: Nightly calculation of average ratings across all users
- T8ke scale (0-10) with one decimal precision
- Ratings displayed on bottle cards, detail pages, and search results
- "Updated daily" indicator for community ratings

## Scheduled Tasks (Cron Jobs)

### Setting up Cron Jobs (macOS)

The application includes two optional cron jobs for enhanced functionality:

1. **Notification Checks** (hourly) - Sends notifications for low stock bottles
2. **Rating Calculations** (nightly at 2 AM) - Updates community ratings

To set up both cron jobs:

```bash
# Run the setup script
./scripts/setup-notifications-cron.sh

# When prompted, choose 'y' to also set up rating calculations
```

Or set them up individually:

```bash
# Notifications only
./scripts/setup-notifications-cron.sh

# Ratings only
./scripts/setup-ratings-cron.sh
```

### Manual Triggers

You can manually trigger the cron endpoints:

```bash
# Trigger notifications
curl -X GET -H "Authorization: Bearer $CRON_SECRET" http://localhost:3005/api/cron/notifications

# Trigger rating calculations
curl -X POST -H "Authorization: Bearer $CRON_SECRET" http://localhost:3005/api/cron/calculate-ratings
```

### Monitoring Cron Jobs

```bash
# Check if jobs are running
launchctl list | grep whiskeyvault

# View logs
tail -f /tmp/whiskeyvault-notifications.log
tail -f /tmp/whiskeyvault-ratings.log
```

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


## Addtional Information
# Whiskey Vault 🥃

A premium whiskey/spirits inventory management system built with Next.js, MongoDB, and TypeScript. Think CellarTracker but specifically designed for whiskey collectors with features like store pick tracking, pour management, and secondary market pricing.

## 🚀 Features

### Core Features
- **Multi-user authentication** with invite-only registration system
- **Master bottle database** - Community-shared whiskey information
- **Personal collection tracking** - Your specific bottles, purchases, and locations
- **CSV import** - Import from CellarTracker or Excel
- **Store pick management** - Track barrel numbers, pick dates, and store-specific details
- **Location/bin management** - Organize bottles across multiple locations
- **Pour tracking** - Monitor consumption of open bottles
- **Dark premium UI** - Glass morphism effects with copper/amber accents

### Upcoming Features
- 📸 **Photo upload** - Multiple photos per bottle via Cloudinary
- 🏷️ **Label printing** - Generate labels with QR codes
- 📱 **UPC/Label scanning** - Quick bottle entry via camera
- 💰 **Secondary market pricing** - Track value with Unicorn Auctions integration
- 📊 **Analytics** - Collection value, drinking patterns, and trends
- 🔄 **Trading/sharing** - Share wishlists with friends

## 🛠️ Tech Stack

- **Frontend**: Next.js 14, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: MongoDB with Mongoose
- **Authentication**: NextAuth.js
- **Image Storage**: Cloudinary (ready for integration)
- **Styling**: Dark theme with copper accents (#B87333, #D2691E)

## 📦 Installation

### Prerequisites
- Node.js 18+
- MongoDB (local or Atlas)
- Git

### Setup

1. **Clone the repository**
```bash
git clone https://github.com/mpr131/whiskey-inventory-app.git
cd whiskey-inventory-app
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment variables**
```bash
cp .env.example .env.local
```

Edit `.env.local`:
```env
# MongoDB connection (local or Atlas)
MONGODB_URI=mongodb://localhost:27017/whiskey-inventory

# NextAuth configuration
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=[generate with: openssl rand -base64 32]

# Cloudinary (optional for now)
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

4. **Run database seed**
```bash
npm run seed
```
This creates an admin user:
- Email: `admin@whiskeyvault.com`
- Password: `admin123`

5. **Start the development server**
```bash
npm run dev
```

Visit http://localhost:3000

## 🗄️ Data Architecture

### MasterBottle Schema
Shared bottle information used by all users:
```javascript
{
  name: String,              // "Russell's Reserve 13 Year"
  brand: String,             // "Russell's Reserve"
  distillery: String,        // "Wild Turkey"
  category: String,          // "Bourbon", "Rye", "Scotch"
  type: String,              // "Kentucky Straight Bourbon"
  age: Number,               // Years aged
  statedProof: Number,       // Standard proof
  msrp: Number,              // Retail price
  description: String,
  isStorePick: Boolean,
  storePickDetails: {
    store: String,
    pickDate: Date,
    warehouse: String,
    floor: String
  }
}
```

### UserBottle Schema
User-specific bottle information:
```javascript
{
  userId: ObjectId,          // Owner
  masterBottleId: ObjectId,  // References MasterBottle
  purchaseDate: Date,
  purchasePrice: Number,
  purchaseLocation: String,
  quantity: Number,          // Bottles owned
  location: {
    area: String,           // "Home", "Storage"
    bin: String             // "A-12", "B-3"
  },
  bottleNumber: String,      // "127 of 250"
  barrelNumber: String,      // Specific barrel for store picks
  actualProof: Number,       // Can vary from stated
  personalNotes: String,
  photos: [String],
  status: String,            // "unopened", "opened", "finished"
  openDate: Date,
  fillLevel: Number,         // Percentage remaining
  pours: [{
    date: Date,
    amount: Number,
    notes: String,
    occasion: String
  }]
}
```

## 📊 Importing Your Collection

### From CellarTracker
1. Export your collection as CSV from CellarTracker
2. Navigate to `/bottles/import` 
3. Upload your CSV file
4. Map columns (automatic detection for common fields)
5. Review and import

### Field Mapping
- `Wine` → MasterBottle name
- `Producer` → Distillery
- `Vintage` → Age/Year
- `Price` → Purchase price
- `Quantity` → Number of bottles
- `BeginConsume/EndConsume` → Drinking window
- `Location` → Storage location
- Notes fields → Personal notes

## 🔑 Authentication & User Management

### Admin Features
- Generate invite codes
- Manage users
- View system statistics
- Manage master bottle database

### Regular Users
- Manage personal collection
- View community bottles
- Track purchases and consumption
- Generate reports

## 🚧 Development

### Project Structure
```
whiskey-inventory-app/
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   ├── auth/              # Auth pages
│   ├── bottles/           # Bottle management
│   └── dashboard/         # Main dashboard
├── components/            # React components
├── lib/                   # Utilities and helpers
├── models/                # Mongoose schemas
├── public/                # Static assets
└── scripts/               # Database scripts
```

### Key Components
- `MasterBottleSearch` - Search/create master bottles
- `BottleForm` - Add/edit bottles with store pick support
- `ImportCSV` - CSV import with mapping
- `LocationManager` - Manage storage locations

### API Endpoints
- `/api/bottles` - CRUD for user bottles
- `/api/master-bottles` - Search/create master bottles
- `/api/import` - CSV import processing
- `/api/auth` - NextAuth endpoints

## 🐛 Known Issues

1. **MongoDB Atlas DNS**: Some networks have issues with `mongodb+srv://` URLs. Use standard connection string format if needed.
2. **Invite Code Length**: Registration form limits invite codes to 8 characters
3. **Photo Upload**: Cloudinary integration pending

## 🤝 Contributing

This is currently a private project, but if you're one of Mike's whiskey buddies with access:

1. Create a feature branch
2. Make your changes
3. Test thoroughly
4. Submit a pull request

## 📈 Future Roadmap

### Phase 1 (Current)
- ✅ Core CRUD operations
- ✅ Master/User bottle architecture
- ✅ CSV import
- ⏳ Photo uploads
- ⏳ Quick add feature

### Phase 2
- Label printing with QR codes
- Barcode/UPC scanning
- Secondary market price tracking
- Advanced search and filtering

### Phase 3
- Mobile app (React Native)
- Social features (trading, wishlists)
- AI-powered tasting notes
- Whiskey recommendations

### Phase 4
- Public bottle database API
- Integration with whiskey retailers
- Collection insurance documentation
- Export to other platforms

## 📝 License

Private project - not for public distribution

## 🙏 Acknowledgments

- Built for the whiskey collecting community
- Inspired by CellarTracker's wine management
- Special thanks to all the store pick groups

---

**Created with** 🥃 **by Mike and the whiskey collecting community**
