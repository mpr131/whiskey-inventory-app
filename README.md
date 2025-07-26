# 🥃 Whiskey Vault

A modern, full-featured whiskey inventory management system with social features, advanced barcode scanning, and a comprehensive database of over 71,000 products.

[![Next.js](https://img.shields.io/badge/Next.js-14.2-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript)](https://www.typescriptlang.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-7.0-green?logo=mongodb)](https://www.mongodb.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38B2AC?logo=tailwind-css)](https://tailwindcss.com/)

## 🚀 Overview

Whiskey Vault is a comprehensive whiskey collection management platform that combines powerful inventory tracking with social features and advanced analytics. Whether you're a casual enthusiast or serious collector, Whiskey Vault helps you catalog, track, and share your whiskey journey.

### Key Differentiators

- **71,000+ Product Database**: Pre-loaded with FWGS (Fine Wine & Good Spirits) catalog including UPCs, pricing, and product details
- **Multi-Format Barcode Scanning**: Supports standard UPCs, custom vault barcodes, and CellarTracker IDs
- **Social Integration**: Connect with friends, share your collection, and track tasting sessions together
- **Advanced Analytics**: Track consumption patterns, collection value, and rating trends
- **Professional Label Printing**: DYMO LabelWriter support for collection organization

## ✨ Major Features

### 📦 Inventory Management
- **Dual-Level Architecture**: Master bottles (product catalog) and user bottles (personal collection)
- **Smart Product Matching**: Automatic matching with 71k+ product database
- **Bulk Import**: CSV import with intelligent column mapping and CellarTracker support
- **Custom Bottles**: Add rare or private label bottles not in the database
- **Location Tracking**: Organize by area, bin, and position
- **Store Pick Support**: Track store-exclusive selections with custom details

### 📱 Advanced Barcode Scanning
- **Multi-Format Support**:
  - Standard UPCs (with/without leading zeros)
  - Vault Barcodes (WV_XXXXX format)
  - CellarTracker IDs (7-8 digit codes)
- **Smart Detection**: Automatically identifies barcode type and searches appropriate database
- **Mobile-Optimized**: Full-screen mobile interface with camera integration
- **Offline Capability**: Scan and queue for later sync

### 👥 Social Features
- **Friend System**: Connect with other collectors
- **Activity Feed**: See what friends are drinking and rating
- **Shared Pour Sessions**: Track group tastings with multiple participants
- **Public Profiles**: Share your collection (with privacy controls)
- **Rating Comparisons**: See how your ratings compare to friends
- **Cheers System**: React to friends' pours and activities

### 🍷 Pour Tracking & Sessions
- **Quick Pour**: Log a drink with one tap
- **Pour Sessions**: Organize themed tastings or events
- **Live Pouring**: Real-time updates when friends are drinking
- **Rating System**: 1-10 scale with tasting notes
- **Analytics**: Track consumption patterns and favorites
- **Cost Tracking**: Monitor pour costs based on bottle prices

### 🏷️ Label Printing
- **DYMO LabelWriter Support**: Direct integration with DYMO printers
- **Multiple Formats**: Large (4"x3") and small (2"x1") label templates
- **QR Codes**: Each label includes scannable QR code
- **Batch Printing**: Print multiple labels at once
- **Custom Fields**: Include location, purchase date, and notes

### 📊 Analytics & Insights
- **Collection Overview**: Total bottles, unique items, total value
- **Consumption Tracking**: Monthly/yearly consumption patterns
- **Rating Analytics**: Average ratings by category, distillery, age
- **Value Tracking**: Current value vs. purchase price
- **Popular Bottles**: Most poured and highest rated
- **Friend Comparisons**: See how your collection compares

### 🔌 FWGS Integration
- **71,000+ Products**: Complete Pennsylvania liquor store inventory
- **Automatic Updates**: Regular syncs with FWGS database
- **Price Tracking**: Current prices and availability
- **UPC Matching**: Instant product identification via barcode
- **Image Library**: Product images for most bottles

## 🛠️ Tech Stack

### Frontend
- **Framework**: Next.js 14.2 (App Router)
- **Language**: TypeScript 5.0
- **Styling**: Tailwind CSS 3.4
- **UI Components**: Custom components with Radix UI primitives
- **State Management**: React hooks with SWR for data fetching
- **Authentication**: NextAuth.js 4.24

### Backend
- **API**: Next.js API Routes
- **Database**: MongoDB 7.0 with Mongoose ODM
- **Image Storage**: Cloudinary for bottle images
- **External APIs**: FWGS data sync, UPC lookup services
- **Cron Jobs**: Scheduled tasks for ratings calculation and notifications

### Infrastructure
- **Deployment**: Docker containers
- **Environment**: Node.js 20.x
- **Package Manager**: npm/yarn
- **Build Tools**: Next.js built-in webpack configuration

## 📋 Installation & Setup

### Prerequisites
- Node.js 20.x or higher
- MongoDB 7.0 or higher
- npm or yarn
- Git

### Environment Variables
Create a `.env` file in the root directory:

```env
# Database
MONGODB_URI=mongodb://localhost:27017/whiskey-vault
MONGODB_URI_EXTERNAL=mongodb://external-db-uri  # For FWGS data

# Authentication
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key-here

# Cloudinary (for image uploads)
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# Email (optional)
EMAIL_SERVER_HOST=smtp.gmail.com
EMAIL_SERVER_PORT=587
EMAIL_SERVER_USER=your-email@gmail.com
EMAIL_SERVER_PASSWORD=your-app-password
EMAIL_FROM=noreply@whiskeyvault.app

# Analytics (optional)
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX
```

### Local Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/whiskey-vault.git
   cd whiskey-vault
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up MongoDB**
   ```bash
   # Start MongoDB locally
   mongod --dbpath /path/to/data/directory
   ```

4. **Initialize the database**
   ```bash
   # Run database migrations
   npm run db:migrate

   # (Optional) Import FWGS data
   npm run import:fwgs
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```

6. **Access the application**
   Open [http://localhost:3000](http://localhost:3000)

## 🗄️ Data Architecture

### MasterBottle Schema
```javascript
{
  name: String,
  brand: String,
  distillery: String,
  category: String,         // Bourbon, Rye, Scotch, etc.
  type: String,            // Specific type
  age: Number,
  statedProof: Number,
  size: String,
  msrp: Number,
  upcCodes: [{
    code: String,
    verifiedCount: Number,
    dateAdded: Date
  }],
  externalData: {
    source: String,        // 'fwgs', 'manual', 'user'
    fwgsId: String,
    sku: String,
    lastSync: Date
  },
  communityRating: Number,
  isActive: Boolean
}
```

### UserBottle Schema
```javascript
{
  userId: ObjectId,
  masterBottleId: ObjectId,
  purchaseDate: Date,
  purchasePrice: Number,
  purchaseLocation: String,
  quantity: Number,
  location: {
    area: String,
    bin: String
  },
  status: String,          // 'unopened', 'opened', 'finished'
  fillLevel: Number,       // 0-100
  personalRating: Number,
  notes: String,
  barcode: String,         // Vault barcode
  cellarTrackerId: String
}
```

### Key Relationships
- **User → UserBottle**: One-to-many (a user owns multiple bottles)
- **UserBottle → MasterBottle**: Many-to-one (multiple users can own the same product)
- **User → Friend**: Many-to-many (bidirectional friendship)
- **Pour → UserBottle**: Many-to-one (multiple pours from one bottle)
- **PourSession → Pour**: One-to-many (session contains multiple pours)

## 🆕 Recent Additions

### FWGS Import System (71k+ Products)
- Comprehensive import scripts for Pennsylvania liquor database
- Automatic UPC parsing and validation
- Duplicate detection and merging
- Proof/ABV data cleaning
- Regular sync capabilities

### Enhanced Barcode Scanner
- Mobile-first responsive design
- Multi-format barcode detection
- Success state with "Scan Another" functionality
- Offline queue for poor connectivity
- Integration with 71k+ product database

### Social Features 2.0
- Live pour notifications
- Activity feed with real-time updates
- Friend bottle comparisons
- Shared tasting sessions
- Public profile pages with privacy controls

### Advanced Pour Tracking
- Session management with themes
- Multi-bottle pour sessions
- Cost-per-pour calculations
- Rating aggregation
- Export capabilities

## 👨‍💼 Admin Features

### User Management
- View all users with stats
- Toggle admin privileges
- Reset user passwords
- Export user data
- Monitor activity

### UPC Management
- Bulk UPC assignment tool
- Manual UPC entry
- Verification system
- Duplicate detection
- FWGS sync status

### Data Import Tools
- FWGS bulk import
- CSV mapping interface
- Duplicate management
- Data validation
- Import history

## 📡 API Documentation

### Key Endpoints

#### Authentication
- `POST /api/auth/signin` - User login
- `POST /api/auth/signup` - User registration
- `GET /api/auth/session` - Current session

#### Bottles
- `GET /api/bottles` - List user bottles
- `POST /api/bottles` - Add new bottle
- `GET /api/bottles/[id]` - Get bottle details
- `PUT /api/bottles/[id]` - Update bottle
- `DELETE /api/bottles/[id]` - Remove bottle

#### Barcode Scanning
- `POST /api/smart-scan` - Intelligent barcode lookup
- `PUT /api/smart-scan` - Add scanned bottle to collection

#### Social
- `GET /api/friends` - List friends
- `POST /api/friends/request` - Send friend request
- `GET /api/feed` - Activity feed
- `GET /api/users/[username]` - Public profile

#### Pour Tracking
- `POST /api/bottles/[id]/pour` - Log a pour
- `GET /api/pour-sessions` - List sessions
- `POST /api/pour-sessions` - Create session

## 🚀 Deployment

### Docker Setup
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

### Environment Configuration
```yaml
# docker-compose.yml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - MONGODB_URI=mongodb://db:27017/whiskey-vault
      - NODE_ENV=production
    depends_on:
      - db
  
  db:
    image: mongo:7.0
    volumes:
      - mongodb_data:/data/db
    ports:
      - "27017:27017"

volumes:
  mongodb_data:
```

### Production Deployment
1. Build Docker image
2. Push to container registry
3. Deploy to cloud provider (AWS, GCP, Azure)
4. Configure environment variables
5. Set up SSL/TLS certificates
6. Configure CDN for static assets

## 🗺️ Future Roadmap

### Q1 2025
- [ ] Mobile app (React Native)
- [ ] Whiskey marketplace integration
- [ ] AI-powered recommendations
- [ ] Advanced collection insights

### Q2 2025
- [ ] Auction price tracking
- [ ] Virtual tasting events
- [ ] Distillery partnerships
- [ ] NFT integration for rare bottles

### Q3 2025
- [ ] International product databases
- [ ] Multi-language support
- [ ] Wholesale/retail features
- [ ] API for third-party apps

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- FWGS for product data access
- The whiskey community for feedback and testing
- All contributors who have helped shape this project

---

**Built with ❤️ by whiskey enthusiasts, for whiskey enthusiasts**