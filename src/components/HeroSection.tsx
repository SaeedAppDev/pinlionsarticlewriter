import { ArrowDown, Sparkles, TrendingUp, Image } from 'lucide-react';
import { motion } from 'framer-motion';

export function HeroSection() {
  const features = [
    { icon: Sparkles, label: 'AI-Powered' },
    { icon: TrendingUp, label: 'SEO Optimized' },
    { icon: Image, label: 'Ready to Pin' },
  ];

  return (
    <section className="relative overflow-hidden gradient-hero py-16 md:py-24">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-3xl mx-auto"
        >
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-6">
            <Sparkles className="w-4 h-4" />
            Powered by AI
          </div>
          
          <h1 className="text-4xl md:text-6xl font-extrabold mb-6 leading-tight">
            Turn Recipes into{' '}
            <span className="text-gradient">Viral Pinterest Pins</span>
          </h1>
          
          <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Generate scroll-stopping Pinterest pins in seconds. AI-powered headlines, 
            stunning visuals, and SEO copy that drives traffic to your food blog.
          </p>

          <div className="flex flex-wrap justify-center gap-4 mb-12">
            {features.map((feature, index) => (
              <motion.div
                key={feature.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + index * 0.1 }}
                className="flex items-center gap-2 bg-card px-4 py-2 rounded-full shadow-md"
              >
                <feature.icon className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">{feature.label}</span>
              </motion.div>
            ))}
          </div>

          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="text-muted-foreground"
          >
            <ArrowDown className="w-6 h-6 mx-auto" />
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
