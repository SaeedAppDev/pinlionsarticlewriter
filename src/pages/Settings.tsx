import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { Save, FileText, List, Code, Key } from 'lucide-react';

import { supabase } from '@/integrations/supabase/client';

interface ApiSettings {
  openai_api_key: string;
  replicate_api_token: string;
  replicate_model: string;
}

const Settings = () => {
  const [openaiKey, setOpenaiKey] = useState('');
  const [replicateToken, setReplicateToken] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('user_api_settings')
        .select('openai_api_key, replicate_api_token, replicate_model')
        .eq('user_id', user.id)
        .single();

      if (data) {
        setOpenaiKey(data.openai_api_key || '');
        setReplicateToken(data.replicate_api_token || '');
      }
    } catch (error) {
      // No settings yet, that's fine
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('user_api_settings')
        .upsert({
          user_id: user.id,
          openai_api_key: openaiKey,
          replicate_api_token: replicateToken,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;
      toast.success('Settings saved successfully!');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 text-foreground">Settings</h1>
          <p className="text-muted-foreground">
            Configure your API keys and generation preferences
          </p>
        </div>

        {/* Currently Active Prompts */}
        <Card className="p-6 mb-6 bg-card border-border">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <h3 className="font-semibold text-foreground">Currently Active Prompts</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Both prompts are shown below. Edit them separately in their own sections.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {/* Classic Articles Card */}
            <Card className="p-4 border-border hover:border-primary/50 transition-colors cursor-pointer">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Classic Articles
                </span>
              </div>
              <h4 className="font-semibold text-primary mb-1">Classic Article Prompt</h4>
              <p className="text-sm text-muted-foreground">Always uses classic article prompt</p>
            </Card>

            {/* Listicle Articles Card */}
            <Card className="p-4 border-primary bg-primary/5 cursor-pointer">
              <div className="flex items-center gap-2 mb-2">
                <List className="w-4 h-4 text-primary" />
                <span className="text-xs font-semibold text-primary uppercase tracking-wide">
                  Listicle Articles
                </span>
              </div>
              <h4 className="font-semibold text-primary mb-1">Home Decor Listicle</h4>
              <p className="text-sm text-muted-foreground">Currently selected listicle category</p>
            </Card>
          </div>
        </Card>

        {/* API Configuration */}
        <Card className="p-6 bg-card border-border">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
              <Code className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">API Configuration</h3>
              <p className="text-sm text-muted-foreground">Article + Image generation providers</p>
            </div>
          </div>

          <p className="text-sm text-muted-foreground mb-6">
            Enter your API keys below. OpenAI will be used for article generation and Replicate for image generation.
          </p>

          <div className="space-y-6">
            {/* OpenAI API Key */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                OpenAI API Key (Articles)
              </label>
              <Input
                type="password"
                value={openaiKey}
                onChange={(e) => setOpenaiKey(e.target.value)}
                placeholder="Enter your OpenAI API key"
                className="bg-card"
              />
            </div>

            {/* Replicate API Token */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Replicate API Token (Images)
              </label>
              <Input
                type="password"
                value={replicateToken}
                onChange={(e) => setReplicateToken(e.target.value)}
                placeholder="Enter your Replicate API token"
                className="bg-card"
              />
              <p className="text-xs text-muted-foreground">
                Your Replicate API token for image generation models. Get yours at{' '}
                <a href="https://replicate.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  replicate.com
                </a>
              </p>
            </div>

            {/* Save Button */}
            <div className="flex justify-end pt-4">
              <Button
                onClick={handleSave}
                disabled={isSaving}
                className="gradient-button text-white border-0"
              >
                <Save className="w-4 h-4 mr-2" />
                {isSaving ? 'Saving...' : 'Save API Settings'}
              </Button>
            </div>
          </div>
        </Card>
    </div>
  );
};

export default Settings;
