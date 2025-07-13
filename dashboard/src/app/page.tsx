import Link from 'next/link'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <header className="border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="text-2xl font-bold text-white">NutriLens</div>
              <div className="text-sm text-gray-400">Powered by MentraOS</div>
            </div>
            <Link 
              href="/dashboard"
              className="bg-[#35c07d] text-white px-4 py-2 rounded-lg hover:bg-[#2da068] transition-colors"
            >
              Open Dashboard
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="py-20 text-center">
          <div className="mb-8">
            <div className="text-8xl mb-6">🔍</div>
            <h1 className="text-6xl font-bold text-white mb-4">
              Nutri<span className="text-[#35c07d]">Lens</span>
            </h1>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto">
              Advanced nutrition tracking powered by AI. Analyze your meals, track your progress, and optimize your health with intelligent insights.
            </p>
          </div>

          <div className="mb-12">
            <Link 
              href="/dashboard"
              className="bg-[#35c07d] text-white px-8 py-4 rounded-lg text-lg font-medium hover:bg-[#2da068] transition-colors inline-block"
            >
              Start Tracking →
            </Link>
          </div>
        </div>

        {/* Features Grid */}
        <div className="pb-20">
          <div className="grid md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="text-center p-6 rounded-lg border border-gray-800 bg-gray-900">
              <div className="text-4xl mb-4">📊</div>
              <h3 className="text-xl font-bold text-white mb-2">Smart Analytics</h3>
              <p className="text-gray-300">
                Comprehensive nutrition analysis with detailed breakdowns of macros, vitamins, and minerals.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="text-center p-6 rounded-lg border border-gray-800 bg-gray-900">
              <div className="text-4xl mb-4">📸</div>
              <h3 className="text-xl font-bold text-white mb-2">Visual Tracking</h3>
              <p className="text-gray-300">
                Capture and analyze your meals with our intelligent image recognition system.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="text-center p-6 rounded-lg border border-gray-800 bg-gray-900">
              <div className="text-4xl mb-4">🎯</div>
              <h3 className="text-xl font-bold text-white mb-2">Goal Tracking</h3>
              <p className="text-gray-300">
                Set and monitor your daily calorie goals with real-time progress tracking.
              </p>
            </div>
          </div>
        </div>

        {/* Stats Section */}
        <div className="pb-20">
          <div className="bg-gray-900 rounded-lg p-12 text-center border border-gray-800">
            <h2 className="text-3xl font-bold text-white mb-8">Your Nutrition Journey</h2>
            <div className="grid md:grid-cols-3 gap-8">
              <div>
                <div className="text-4xl font-bold text-[#35c07d] mb-2">2,400</div>
                <div className="text-gray-300">Daily Calorie Target</div>
              </div>
              <div>
                <div className="text-4xl font-bold text-[#35c07d] mb-2">24/7</div>
                <div className="text-gray-300">Continuous Monitoring</div>
              </div>
              <div>
                <div className="text-4xl font-bold text-[#35c07d] mb-2">100%</div>
                <div className="text-gray-300">Accurate Analysis</div>
              </div>
            </div>
          </div>
        </div>

        {/* How It Works */}
        <div className="pb-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-4">How It Works</h2>
            <p className="text-gray-300 max-w-2xl mx-auto">
              Get started with NutriLens in three simple steps
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-[#35c07d] text-white rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
                1
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Capture</h3>
              <p className="text-gray-300">
                Take a photo of your meal or manually log your food intake
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-[#35c07d] text-white rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
                2
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Analyze</h3>
              <p className="text-gray-300">
                Our AI processes your meal and extracts detailed nutrition information
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-[#35c07d] text-white rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
                3
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Track</h3>
              <p className="text-gray-300">
                Monitor your progress and optimize your nutrition goals
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800 bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <div className="text-lg font-bold text-white mb-2">NutriLens</div>
            <p className="text-gray-400 text-sm">
              Powered by MentraOS • Advanced Nutrition Intelligence
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
