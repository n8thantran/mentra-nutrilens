'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { NutritionFacts } from '@/lib/types'
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts'
import Image from 'next/image'

const DAILY_CALORIE_TARGET = 2400
const ENTRIES_PER_PAGE = 8

// Function to format timestamp to PST
const formatToPST = (timestamp: string) => {
  const date = new Date(timestamp)
  return date.toLocaleString('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  })
}

// Function to get relative time (e.g., "2 hours ago")
const getRelativeTime = (timestamp: string) => {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`
  
  return formatToPST(timestamp)
}

// Modal component for detailed meal information
const MealDetailModal = ({ meal, onClose }: { meal: NutritionFacts; onClose: () => void }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-black">Meal Details</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-black text-2xl font-bold"
            >
              ×
            </button>
          </div>

          {/* Image */}
                     <div className="mb-6">
             {meal.imgURL ? (
               <div className="relative w-full h-64 rounded-lg overflow-hidden bg-gray-100">
                 <Image
                   src={meal.imgURL}
                   alt="Meal image"
                   fill
                   className="object-contain"
                 />
               </div>
             ) : (
               <div className="w-full h-64 bg-gray-200 rounded-lg flex items-center justify-center">
                 <span className="text-6xl">🍽️</span>
               </div>
             )}
           </div>

          {/* Timestamp */}
          <div className="mb-6 text-center">
            <p className="text-gray-600 text-sm">{formatToPST(meal.timestamp)}</p>
            <p className="text-gray-500 text-xs">{getRelativeTime(meal.timestamp)}</p>
          </div>

          {/* Macronutrients */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-black mb-3">Macronutrients</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-black">{meal.calories}</div>
                <div className="text-sm text-gray-600">Calories</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-black">{meal.protein}g</div>
                <div className="text-sm text-gray-600">Protein</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-black">{meal.carbs}g</div>
                <div className="text-sm text-gray-600">Carbs</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-black">{meal.fats}g</div>
                <div className="text-sm text-gray-600">Fats</div>
              </div>
            </div>
          </div>

          {/* Additional Nutrients */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-black mb-3">Additional Nutrients</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Sugar:</span>
                <span className="font-medium text-black">{meal.sugar}g</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Cholesterol:</span>
                <span className="font-medium text-black">{meal.cholesterol}mg</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Sodium:</span>
                <span className="font-medium text-black">{meal.sodium || 0}mg</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Potassium:</span>
                <span className="font-medium text-black">{meal.potassium || 0}mg</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Calcium:</span>
                <span className="font-medium text-black">{meal.calcium || 0}mg</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Iron:</span>
                <span className="font-medium text-black">{meal.iron || 0}mg</span>
              </div>
            </div>
          </div>

          {/* Vitamins */}
          <div>
            <h3 className="text-lg font-semibold text-black mb-3">Vitamins</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Vitamin A:</span>
                <span className="font-medium text-black">{meal.vitamin_a}g</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Vitamin C:</span>
                <span className="font-medium text-black">{meal.vitamin_c}mg</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Vitamin D:</span>
                <span className="font-medium text-black">{meal.vitamin_d}g</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Vitamin E:</span>
                <span className="font-medium text-black">{meal.vitamin_e}g</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Vitamin K:</span>
                <span className="font-medium text-black">{meal.vitamin_k}g</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Vitamin B1:</span>
                <span className="font-medium text-black">{meal.vitamin_b1}mg</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Vitamin B2:</span>
                <span className="font-medium text-black">{meal.vitamin_b2}mg</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Vitamin B3:</span>
                <span className="font-medium text-black">{meal.vitamin_b3}mg</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Vitamin B6:</span>
                <span className="font-medium text-black">{meal.vitamin_b6}mg</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Vitamin B12:</span>
                <span className="font-medium text-black">{meal.vitamin_b12}g</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Folate (B9):</span>
                <span className="font-medium text-black">{meal.vitamin_b9}g</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function NutritionDashboard() {
  const [nutritionData, setNutritionData] = useState<NutritionFacts[]>([])
  const [loading, setLoading] = useState(true)
  const [reloading, setReloading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedMeal, setSelectedMeal] = useState<NutritionFacts | null>(null)
  const [currentPage, setCurrentPage] = useState(1)

  const supabase = createClient()

  const fetchNutritionData = async (isReload = false) => {
    try {
      if (isReload) {
        setReloading(true)
      } else {
        setLoading(true)
      }
      setError(null)
      
      const { data, error } = await supabase
        .from('nutrition_facts')
        .select('*')
        .order('timestamp', { ascending: false }) // Order by newest first

      if (error) {
        setError(error.message)
      } else {
        // Filter out entries with null calories
        const validData = (data || []).filter(item => item.calories !== null && item.calories !== undefined)
        setNutritionData(validData)
      }
    } catch {
      setError('Failed to fetch nutrition data')
    } finally {
      setLoading(false)
      setReloading(false)
    }
  }

  useEffect(() => {
    fetchNutritionData()
  }, [supabase]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-black border-t-transparent mx-auto mb-4"></div>
          <p className="text-black text-lg font-medium">Loading nutrition data...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 max-w-md mx-4">
          <div className="text-center">
            <div className="text-red-500 text-6xl mb-4">⚠️</div>
            <h2 className="text-black text-xl font-bold mb-2">Error Loading Data</h2>
            <p className="text-gray-600">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  // Calculate today's totals (using the latest entry for simplicity)
  const todayData = nutritionData.length > 0 ? nutritionData[0] : null // Changed to use first item (newest)

  // Calculate total calories for today (all entries from today)
  const today = new Date()
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const todayEntries = nutritionData.filter(item => {
    const itemDate = new Date(item.timestamp)
    return itemDate >= todayStart
  })
  
  const totalTodayCalories = todayEntries.reduce((sum, item) => sum + item.calories, 0)
  const totalCaloriesRemaining = DAILY_CALORIE_TARGET - totalTodayCalories
  const totalCalorieProgress = Math.min((totalTodayCalories / DAILY_CALORIE_TARGET) * 100, 100)

  // Pagination logic
  const totalPages = Math.ceil(nutritionData.length / ENTRIES_PER_PAGE)
  const startIndex = (currentPage - 1) * ENTRIES_PER_PAGE
  const endIndex = startIndex + ENTRIES_PER_PAGE
  const currentEntries = nutritionData.slice(startIndex, endIndex)

  // Prepare data for charts
  const macroData = nutritionData.slice(0, 10).map((item, index) => ({
    name: `${index + 1}`,
    calories: item.calories,
    protein: item.protein,
    carbs: item.carbs,
    fats: item.fats,
    target: DAILY_CALORIE_TARGET
  }))

  const todayMacros = todayData ? [
    { name: 'Protein', value: todayData.protein, color: '#35c07d' },
    { name: 'Carbs', value: todayData.carbs, color: '#2da068' },
    { name: 'Fats', value: todayData.fats, color: '#3fe696' },
    { name: 'Sugar', value: todayData.sugar, color: '#7dd3fc' }
  ] : []

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 shadow-lg">
          <p className="font-semibold text-white">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} className="text-sm text-gray-300">
              {entry.name}: {entry.value}
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <div className="border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">NutriLens</h1>
              <p className="text-gray-400">Powered by MentraOS • Advanced Nutrition Tracking</p>
            </div>
            <div className="flex items-center space-x-4">
              <button 
                onClick={() => fetchNutritionData(true)}
                disabled={reloading}
                className="bg-[#35c07d] text-white px-4 py-2 rounded-lg hover:bg-[#2da068] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {reloading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    <span>Reloading...</span>
                  </>
                ) : (
                  <>
                    <span>🔄</span>
                    <span>Reload</span>
                  </>
                )}
              </button>
              <div className="text-right">
                <div className="text-2xl font-bold text-[#35c07d]">{totalTodayCalories}</div>
                <div className="text-sm text-gray-400">of {DAILY_CALORIE_TARGET} calories today</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {nutritionData.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-8xl mb-6">📊</div>
            <h2 className="text-2xl font-bold text-black mb-2">No nutrition data found</h2>
            <p className="text-gray-600">Start logging your meals to see your nutrition insights</p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Calorie Progress Section */}
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
              <h3 className="text-xl font-bold text-white mb-4">Today&apos;s Calorie Progress</h3>
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-gray-400">Progress</span>
                <span className="text-sm font-medium text-white">{totalCalorieProgress.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-4 mb-4">
                <div 
                  className="bg-[#35c07d] h-4 rounded-full transition-all duration-300"
                  style={{ width: `${totalCalorieProgress}%` }}
                ></div>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Consumed: {totalTodayCalories} cal</span>
                <span className="text-gray-400">
                  {totalCaloriesRemaining > 0 ? `Remaining: ${totalCaloriesRemaining} cal` : `Over by: ${Math.abs(totalCaloriesRemaining)} cal`}
                </span>
              </div>
            </div>

            {/* Food History Section */}
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-white">Food History</h3>
                <span className="text-sm text-gray-400">
                  {nutritionData.length} total entries
                </span>
              </div>
              
              <div className="space-y-4">
                {currentEntries.map((item) => (
                  <div 
                    key={item.id} 
                    className="flex items-center space-x-4 p-4 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors cursor-pointer"
                    onClick={() => setSelectedMeal(item)}
                  >
                    {/* Food Image */}
                    <div className="flex-shrink-0">
                      {item.imgURL ? (
                        <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-gray-100">
                          <Image
                            src={item.imgURL}
                            alt="Food item"
                            fill
                            className="object-contain"
                            sizes="64px"
                          />
                        </div>
                      ) : (
                        <div className="w-16 h-16 bg-gray-300 rounded-lg flex items-center justify-center">
                          <span className="text-2xl">🍽️</span>
                        </div>
                      )}
                    </div>
                    
                    {/* Food Details */}
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className="text-lg font-semibold text-white">Food Entry #{item.id.slice(-8)}</h4>
                        <span className="text-sm text-gray-400">{getRelativeTime(item.timestamp)}</span>
                      </div>
                      <p className="text-sm text-gray-400 mb-2">{formatToPST(item.timestamp)}</p>
                      
                      {/* Nutrition Summary */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-gray-400">Calories:</span>
                          <span className="font-semibold text-white ml-1">{item.calories}</span>
                        </div>
                        <div>
                          <span className="text-gray-400">Protein:</span>
                          <span className="font-semibold text-white ml-1">{item.protein}g</span>
                        </div>
                        <div>
                          <span className="text-gray-400">Carbs:</span>
                          <span className="font-semibold text-white ml-1">{item.carbs}g</span>
                        </div>
                        <div>
                          <span className="text-gray-400">Fats:</span>
                          <span className="font-semibold text-white ml-1">{item.fats}g</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Click indicator */}
                    <div className="flex-shrink-0">
                      <span className="text-gray-400">→</span>
                    </div>
                  </div>
                ))}
              </div>
              
                             {/* Pagination */}
               {totalPages > 1 && (
                 <div className="flex items-center justify-center mt-8 space-x-2">
                   <button
                     onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                     disabled={currentPage === 1}
                     className="px-3 py-1 border border-gray-600 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700 text-white"
                   >
                     Previous
                   </button>
                   
                   <div className="flex space-x-1">
                     {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                       <button
                         key={page}
                         onClick={() => setCurrentPage(page)}
                         className={`px-3 py-1 text-sm rounded ${
                           currentPage === page
                             ? 'bg-[#35c07d] text-white'
                             : 'border border-gray-600 hover:bg-gray-700 text-white'
                         }`}
                       >
                         {page}
                       </button>
                     ))}
                   </div>
                   
                   <button
                     onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                     disabled={currentPage === totalPages}
                     className="px-3 py-1 border border-gray-600 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700 text-white"
                   >
                     Next
                   </button>
                 </div>
               )}
            </div>

                        {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Today&apos;s Calories', value: totalTodayCalories, unit: '', target: DAILY_CALORIE_TARGET },
                { label: 'Latest Protein', value: todayData?.protein || 0, unit: 'g', target: null },
                { label: 'Latest Carbs', value: todayData?.carbs || 0, unit: 'g', target: null },
                { label: 'Latest Fats', value: todayData?.fats || 0, unit: 'g', target: null }
              ].map((stat, index) => (
                <div key={index} className="bg-gray-900 border border-gray-800 rounded-lg p-4 hover:bg-gray-800 transition-colors">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-[#35c07d] mb-1">
                      {stat.value}{stat.unit}
                    </div>
                    <div className="text-sm text-white mb-1">{stat.label}</div>
                    {stat.target && (
                      <div className="text-xs text-gray-400">Target: {stat.target}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Macronutrient Distribution */}
              <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
                <h3 className="text-xl font-bold text-white mb-4">Latest Entry Macros</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={todayMacros}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value }) => `${name}: ${value}g`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {todayMacros.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Calorie Trend */}
              <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
                <h3 className="text-xl font-bold text-white mb-4">Recent Calorie Trend</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={macroData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 12 }} />
                    <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Line 
                      type="monotone" 
                      dataKey="calories" 
                      stroke="#35c07d" 
                      strokeWidth={2}
                      dot={{ fill: '#35c07d', strokeWidth: 2, r: 4 }}
                    />
                    <Legend />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

                        {/* Nutrition Summary */}
            {todayData && (
              <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
                <h3 className="text-xl font-bold text-white mb-4">Latest Entry - Detailed Nutrition</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {[
                    { label: 'Sugar', value: todayData.sugar, unit: 'g' },
                    { label: 'Cholesterol', value: todayData.cholesterol, unit: 'mg' },
                    { label: 'Vitamin A', value: todayData.vitamin_a, unit: 'µg' },
                    { label: 'Vitamin C', value: todayData.vitamin_c, unit: 'mg' },
                    { label: 'Vitamin D', value: todayData.vitamin_d, unit: 'µg' },
                    { label: 'Iron', value: todayData.iron || 0, unit: 'mg' },
                    { label: 'Calcium', value: todayData.calcium || 0, unit: 'mg' },
                    { label: 'Potassium', value: todayData.potassium || 0, unit: 'mg' },
                    { label: 'Sodium', value: todayData.sodium || 0, unit: 'mg' }
                  ].map((nutrient, index) => (
                    <div key={index} className="text-center">
                      <div className="text-lg font-semibold text-[#35c07d]">{nutrient.value}{nutrient.unit}</div>
                      <div className="text-sm text-gray-400">{nutrient.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal */}
      {selectedMeal && (
        <MealDetailModal 
          meal={selectedMeal} 
          onClose={() => setSelectedMeal(null)} 
        />
      )}
    </div>
  )
} 