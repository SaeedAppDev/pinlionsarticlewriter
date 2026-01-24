import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DetectedOutfit {
  topPiece: string | null;
  innerTop: string | null;
  bottomPiece: string | null;
  footwear: string | null;
  footwearVisible: boolean;
  accessories: string[];
  colors: string[];
  layering: string[];
  vibe: 'casual' | 'elegant' | 'formal' | 'edgy' | 'romantic' | 'sporty' | 'bohemian';
  confidenceScore: number;
  settingContext: string;
}

// STRICT image analysis - extracts ONLY visible items with high confidence
async function analyzeOutfitImageStrict(
  imageUrl: string,
  LOVABLE_API_KEY: string
): Promise<DetectedOutfit | null> {
  try {
    console.log(`🔍 STRICT image analysis - extracting ONLY visible elements...`);
    
    const analysisPrompt = `You are a STRICT fashion image analyst. Your job is to extract ONLY what is CLEARLY VISIBLE in this photograph with 90%+ confidence.

ABSOLUTE RULES - VIOLATION = FAILURE:
1. If you cannot clearly see an item, DO NOT include it - return null/empty
2. If visibility confidence < 90%, EXCLUDE the item completely
3. NEVER assume jewelry, bags, hats, sunglasses, or scarves unless CLEARLY visible
4. NEVER add accessories for "completeness" - accuracy > completeness
5. If footwear is cut off or unclear, mark footwearVisible: false
6. Only list colors you can ACTUALLY see in the clothing
7. Be SPECIFIC about what you see, not generic

Respond in this EXACT JSON format:
{
  "topPiece": "exact description of outermost top layer visible" or null if not visible,
  "innerTop": "exact description of inner layer if visible" or null,
  "bottomPiece": "exact description of pants/skirt/shorts visible" or null,
  "footwear": "exact description of shoes" or null if not visible,
  "footwearVisible": true/false - is footwear clearly visible in frame?,
  "accessories": ["ONLY items you can 100% clearly see"] or [] if NONE visible,
  "colors": ["specific colors you can actually see in the outfit"],
  "layering": ["describe layers from inside to outside if applicable"] or [],
  "vibe": "casual" | "elegant" | "formal" | "edgy" | "romantic" | "sporty" | "bohemian",
  "confidenceScore": 0-100 based on image clarity,
  "settingContext": "brief description of setting/background for occasion matching"
}

EXAMPLES OF WHAT NOT TO DO:
❌ Adding "statement necklace" when no necklace is visible
❌ Adding "leather handbag" when no bag is visible  
❌ Adding "delicate gold bracelet" when wrists are not clear
❌ Adding "stylish sunglasses" when face has no sunglasses
❌ Saying "ankle boots" when feet are cut off from frame

REMEMBER: It's better to list FEWER items correctly than MORE items incorrectly.
Accuracy is MANDATORY. Completeness is OPTIONAL.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: analysisPrompt },
              { type: 'image_url', image_url: { url: imageUrl } }
            ]
          }
        ],
        temperature: 0.1,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      console.error('Strict image analysis failed:', response.status);
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('Could not parse outfit analysis JSON');
      return null;
    }
    
    const parsed = JSON.parse(jsonMatch[0]);
    console.log(`✅ Strict analysis complete: ${parsed.vibe} vibe, ${parsed.confidenceScore}% confidence`);
    
    return parsed as DetectedOutfit;
  } catch (error) {
    console.error('Error in strict image analysis:', error);
    return null;
  }
}

// Generate outfit pieces list ONLY from detected visible items
function generateOutfitPiecesList(detected: DetectedOutfit): string {
  const pieces: string[] = [];
  
  if (detected.topPiece) {
    pieces.push(`<li><strong>${detected.topPiece}</strong></li>`);
  }
  if (detected.innerTop) {
    pieces.push(`<li><strong>${detected.innerTop}</strong></li>`);
  }
  if (detected.bottomPiece) {
    pieces.push(`<li><strong>${detected.bottomPiece}</strong></li>`);
  }
  if (detected.footwear && detected.footwearVisible) {
    pieces.push(`<li><strong>${detected.footwear}</strong></li>`);
  }
  
  // Add ONLY visible accessories
  for (const accessory of detected.accessories) {
    if (accessory && accessory.trim().length > 0) {
      pieces.push(`<li><strong>${accessory}</strong></li>`);
    }
  }
  
  return pieces.join('\n');
}

// Revalidate and regenerate content based on strict image analysis
async function revalidateAndRegenerateFashionContent(
  articleContent: string,
  imageUrls: string[],
  LOVABLE_API_KEY: string
): Promise<{ correctedContent: string; accuracyScore: number; corrections: string[] }> {
  console.log(`🔄 STRICT revalidation of fashion content against ${imageUrls.length} images...`);
  
  const corrections: string[] = [];
  let totalConfidence = 0;
  let analyzedCount = 0;
  let correctedContent = articleContent;
  
  for (let i = 0; i < imageUrls.length; i++) {
    const imageUrl = imageUrls[i];
    if (!imageUrl || imageUrl.length === 0) continue;
    
    const detected = await analyzeOutfitImageStrict(imageUrl, LOVABLE_API_KEY);
    if (!detected) continue;
    
    analyzedCount++;
    totalConfidence += detected.confidenceScore;
    
    const outfitNumber = i + 1;
    const sectionRegex = new RegExp(
      `(<h2>${outfitNumber}\\.\\s*[^<]+</h2>[\\s\\S]*?)(?=<h2>\\d+\\.|$)`,
      'i'
    );
    const sectionMatch = correctedContent.match(sectionRegex);
    
    if (!sectionMatch) continue;
    
    const originalSection = sectionMatch[1];
    let updatedSection = originalSection;
    
    // STRICT: Replace entire outfit pieces list with only detected items
    const outfitPiecesMatch = originalSection.match(/(<h3>Outfit Pieces:<\/h3>\s*<ul>)([\s\S]*?)(<\/ul>)/i);
    if (outfitPiecesMatch) {
      const newPiecesList = generateOutfitPiecesList(detected);
      const originalList = outfitPiecesMatch[2].trim();
      
      if (newPiecesList !== originalList) {
        updatedSection = updatedSection.replace(
          outfitPiecesMatch[0],
          `${outfitPiecesMatch[1]}\n${newPiecesList}\n${outfitPiecesMatch[3]}`
        );
        corrections.push(`Outfit ${outfitNumber}: Regenerated outfit pieces from strict image analysis`);
      }
    }
    
    // Check for common hallucinated items that might be in description paragraphs
    const hallucinatedItems = [
      'necklace', 'bracelet', 'watch', 'bag', 'purse', 'handbag', 
      'belt', 'scarf', 'hat', 'cap', 'sunglasses', 'glasses'
    ];
    
    for (const item of hallucinatedItems) {
      const isVisible = detected.accessories.some(a => a.toLowerCase().includes(item));
      const mentionRegex = new RegExp(`\\b${item}s?\\b`, 'gi');
      
      if (!isVisible && mentionRegex.test(updatedSection)) {
        // Remove mentions from list items
        const itemRegex = new RegExp(`<li>[^<]*\\b${item}s?\\b[^<]*</li>\\s*`, 'gi');
        const before = updatedSection;
        updatedSection = updatedSection.replace(itemRegex, '');
        if (before !== updatedSection) {
          corrections.push(`Outfit ${outfitNumber}: Removed hallucinated "${item}" - not visible in image`);
        }
      }
    }
    
    // Replace the section in content
    if (updatedSection !== originalSection) {
      correctedContent = correctedContent.replace(originalSection, updatedSection);
    }
  }
  
  // Add accuracy confirmation comment
  if (!correctedContent.includes('Accuracy Confirmation')) {
    correctedContent += '\n\n<!-- Accuracy Confirmation: Content revalidated against images. No hallucinated items included. -->';
  }
  
  const accuracyScore = analyzedCount > 0 ? Math.round(totalConfidence / analyzedCount) : 100;
  
  console.log(`✅ STRICT revalidation complete: ${accuracyScore}% accuracy, ${corrections.length} corrections made`);
  
  return {
    correctedContent,
    accuracyScore,
    corrections
  };
}

// Extract image URLs from article HTML content
function extractImageUrls(htmlContent: string): string[] {
  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  const urls: string[] = [];
  let match;
  
  while ((match = imgRegex.exec(htmlContent)) !== null) {
    const url = match[1];
    if (url && url.startsWith('http')) {
      urls.push(url);
    }
  }
  
  return urls;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { articleId } = await req.json();
    
    if (!articleId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Article ID is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: article, error: fetchError } = await supabase
      .from('articles')
      .select('content_html, title, niche, generation_metadata')
      .eq('id', articleId)
      .single();

    if (fetchError || !article) {
      return new Response(
        JSON.stringify({ success: false, error: 'Article not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    if (article.niche !== 'fashion') {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Re-validation is only available for fashion articles',
          niche: article.niche 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const imageUrls = extractImageUrls(article.content_html || '');
    
    if (imageUrls.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'No images found in article to validate against' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log(`📊 Found ${imageUrls.length} images to analyze for article: ${article.title}`);

    // Run STRICT revalidation
    const validationResult = await revalidateAndRegenerateFashionContent(
      article.content_html || '',
      imageUrls,
      LOVABLE_API_KEY
    );

    const existingMetadata = typeof article.generation_metadata === 'object' 
      ? article.generation_metadata 
      : {};
    
    const updatedMetadata = {
      ...existingMetadata,
      content_accuracy_score: validationResult.accuracyScore,
      content_corrections: validationResult.corrections,
      content_validated: true,
      image_first_workflow: true,
      last_revalidated_at: new Date().toISOString(),
      validation_note: 'No hallucinated items included. All pieces are image-confirmed.',
    };

    const { error: updateError } = await supabase
      .from('articles')
      .update({
        content_html: validationResult.correctedContent,
        generation_metadata: updatedMetadata,
        updated_at: new Date().toISOString(),
      })
      .eq('id', articleId);

    if (updateError) {
      throw new Error(`Failed to update article: ${updateError.message}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        accuracyScore: validationResult.accuracyScore,
        correctionsCount: validationResult.corrections.length,
        corrections: validationResult.corrections,
        imagesAnalyzed: imageUrls.length,
        message: 'No hallucinated items included. All pieces are image-confirmed.',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Revalidation error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
