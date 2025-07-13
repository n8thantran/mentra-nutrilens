# 🚀 Environment Setup Guide

## Step 1: Create your .env.local file

Create a file called `.env.local` in your project root directory and add your Supabase credentials:

```env
# Copy these lines and replace with your actual values
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

## Step 2: Get your Supabase credentials

1. Go to your Supabase project dashboard
2. Navigate to Settings > API
3. Copy the **Project URL** and paste it as `NEXT_PUBLIC_SUPABASE_URL`
4. Copy the **anon public** key and paste it as `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Step 3: Set up your database table

Make sure your `nutrition_facts` table exists in Supabase with these columns:
- `id` (uuid, primary key)
- `calories` (numeric)
- `fats` (numeric)
- `protein` (numeric)
- `carbs` (numeric)
- `sugar` (numeric)
- `cholesterol` (numeric)
- `vitamin_a` through `vitamin_b12` (all numeric)

## Step 4: Run the app

```bash
npm run dev
```

Visit `http://localhost:3000` to see your beautiful dashboard! 🎉

## 🎨 Your Dashboard Now Features:
- Stunning gradient backgrounds
- Interactive charts with animations
- Glass-morphism effects
- Colorful data visualization
- Responsive design that works on all devices
- Perfect contrast and readability

Enjoy your amazing nutrition dashboard! 🥗✨ 