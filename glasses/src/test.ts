import { NutritionFactsEstimator } from './NutritionFactsEstimator';

async function main() {
  const estimator = new NutritionFactsEstimator();
  const imageUrl = 'https://p70oi85l49.ufs.sh/f/nh2RhlWG3N8Jj3KsfdErZlYx9hSuCXatgqW8zNb12eOVndk0';

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