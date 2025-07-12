import { NutritionFactsEstimator } from './NutritionFactsEstimator';

async function main() {
  const estimator = new NutritionFactsEstimator();
  const imageUrl = 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/Cheeseburger.jpg/500px-Cheeseburger.jpg';

  try {
    const result = await estimator.processImageUrl(imageUrl);
    console.log('\n' + '='.repeat(50));
    console.log('NUTRITION FACTS ESTIMATION RESULTS');
    console.log('='.repeat(50));
    console.log(JSON.stringify(result, null, 2));
  } catch (e: any) {
    console.error(`Error: ${e.message}`);
  }
}

main(); 