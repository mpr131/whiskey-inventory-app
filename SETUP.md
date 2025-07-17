# MongoDB Atlas Setup Guide

## 1. Get Your MongoDB Atlas Connection String

1. Log in to [MongoDB Atlas](https://cloud.mongodb.com)
2. Click on "Connect" for your cluster
3. Choose "Connect your application"
4. Select "Node.js" as your driver and version "5.5 or later"
5. Copy the connection string - it looks like:
   ```
   mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```

## 2. Configure Your Connection String

Replace the placeholders in your connection string:
- `<username>`: Your database user username
- `<password>`: Your database user password
- Add your database name before the `?` - for this app use `whiskey-inventory`

Final format:
```
mongodb+srv://myuser:mypassword@cluster0.xxxxx.mongodb.net/whiskey-inventory?retryWrites=true&w=majority
```

## 3. Set Up Environment Variables

1. Copy the example environment file:
   ```bash
   cp .env.example .env.local
   ```

2. Edit `.env.local` and add your MongoDB connection string:
   ```
   MONGODB_URI=mongodb+srv://myuser:mypassword@cluster0.xxxxx.mongodb.net/whiskey-inventory?retryWrites=true&w=majority
   ```

3. Generate a secure NextAuth secret:
   ```bash
   openssl rand -base64 32
   ```
   Or use: https://generate-secret.vercel.app/32

4. Update your `.env.local`:
   ```
   NEXTAUTH_SECRET=your-generated-secret-here
   ```

## 4. MongoDB Atlas Network Access

**IMPORTANT**: Make sure your IP address is whitelisted in MongoDB Atlas:
1. In Atlas, go to "Network Access" in the left sidebar
2. Click "Add IP Address"
3. Either:
   - Click "Add Current IP Address" for development
   - Or add `0.0.0.0/0` to allow access from anywhere (less secure, but needed for some deployments)

## 5. Run the Application

1. Install dependencies:
   ```bash
   npm install
   ```

2. Seed the database with an admin user:
   ```bash
   npm run seed
   ```
   This creates:
   - Admin email: `admin@whiskeyvault.com`
   - Admin password: `admin123`

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open http://localhost:3000 and sign in with the admin credentials

## Troubleshooting

### "MongoServerError: bad auth"
- Double-check your username and password in the connection string
- Make sure you're using a database user (not your Atlas account login)
- Password special characters must be URL encoded

### "MongoNetworkError: connection timed out"
- Check your IP is whitelisted in Atlas Network Access
- Verify your cluster is active and not paused
- Check your internet connection

### "MONGODB_URI is not defined"
- Make sure you created `.env.local` (not just `.env`)
- Restart your development server after changing environment variables