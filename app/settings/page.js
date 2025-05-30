'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle, User, Leaf } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";

export default function SettingsPage() {
  const router = useRouter();
  const { user, supabase } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [profile, setProfile] = useState({
    display_name: '',
    email: '',
    bio: '',
    location: '',
    website: '',
    show_admin_plants: true,
    show_admin_collections: true,
    show_admin_sightings: true
  });

  useEffect(() => {
    if (!user) {
      router.push('/');
      return;
    }

    const fetchProfile = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (error) throw error;

        if (data) {
          setProfile({
            display_name: data.display_name || '',
            email: user.email || '',
            bio: data.bio || '',
            location: data.location || '',
            website: data.website || '',
            show_admin_plants: data.show_admin_plants ?? true,
            show_admin_collections: data.show_admin_collections ?? true,
            show_admin_sightings: data.show_admin_sightings ?? true
          });
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
        setMessage({ type: 'error', text: 'Error loading profile' });
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [user, router, supabase]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ type: '', text: '' });

    try {
      if (!user?.id) {
        throw new Error('No authenticated user found');
      }

      const { data, error } = await supabase
        .from('profiles')
        .update({
          display_name: profile.display_name,
          bio: profile.bio,
          location: profile.location,
          website: profile.website,
          show_admin_plants: profile.show_admin_plants,
          show_admin_collections: profile.show_admin_collections,
          show_admin_sightings: profile.show_admin_sightings,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)
        .select()
        .single();

      if (error) {
        console.error('Supabase error details:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        });
        throw new Error(error.message || 'Failed to update profile');
      }

      if (!data) {
        throw new Error('No data returned after update');
      }

      setMessage({ type: 'success', text: 'Settings updated successfully' });
    } catch (error) {
      console.error('Error updating settings:', {
        error,
        message: error.message,
        stack: error.stack
      });
      setMessage({ 
        type: 'error', 
        text: error.message || 'An unexpected error occurred while updating your settings. Please try again.' 
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100">
        <Header />
        <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 pb-16">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
              <p className="text-sm text-gray-500">Manage your account settings and preferences.</p>
            </div>
            <Separator />
            <Tabs defaultValue="profile" orientation="vertical" className="w-full">
              <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-6 items-start">
                <TabsList className="flex flex-col h-auto w-full bg-transparent p-0 self-start">
                  <TabsTrigger 
                    value="profile" 
                    className="w-full justify-start px-4 py-2 data-[state=active]:bg-green-50 data-[state=active]:text-green-600"
                  >
                    <User className="w-4 h-4 mr-2" />
                    Profile
                  </TabsTrigger>
                  <TabsTrigger 
                    value="plants" 
                    className="w-full justify-start px-4 py-2 data-[state=active]:bg-green-50 data-[state=active]:text-green-600"
                  >
                    <Leaf className="w-4 h-4 mr-2" />
                    Plants
                  </TabsTrigger>
                </TabsList>
                <div className="space-y-6 self-start">
                  <TabsContent value="profile" className="mt-0">
                    <Card>
                      <CardHeader>
                        <CardTitle>Profile Settings</CardTitle>
                        <CardDescription>Update your personal information and preferences.</CardDescription>
                      </CardHeader>
                      <CardContent>
                        {message.text && (
                          <div className={`mb-4 p-4 rounded-lg flex items-center gap-2 ${
                            message.type === 'error' ? 'bg-red-50 text-red-800' : 'bg-green-50 text-green-800'
                          }`}>
                            {message.type === 'error' ? (
                              <AlertCircle className="w-5 h-5" />
                            ) : (
                              <CheckCircle className="w-5 h-5" />
                            )}
                            <span>{message.text}</span>
                          </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-6">
                          <div className="space-y-2">
                            <Label htmlFor="display_name">Display Name</Label>
                            <Input
                              id="display_name"
                              value={profile.display_name}
                              onChange={(e) => setProfile({ ...profile, display_name: e.target.value })}
                              placeholder="Your display name"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input
                              id="email"
                              value={profile.email}
                              disabled
                              className="bg-gray-50"
                            />
                            <p className="text-sm text-gray-500">Email cannot be changed</p>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="bio">Bio</Label>
                            <Input
                              id="bio"
                              value={profile.bio}
                              onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                              placeholder="Tell us about yourself"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="location">Location</Label>
                            <Input
                              id="location"
                              value={profile.location}
                              onChange={(e) => setProfile({ ...profile, location: e.target.value })}
                              placeholder="Your location"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="website">Website</Label>
                            <Input
                              id="website"
                              value={profile.website}
                              onChange={(e) => setProfile({ ...profile, website: e.target.value })}
                              placeholder="Your website"
                            />
                          </div>

                          <Button
                            type="submit"
                            disabled={saving}
                            className="w-full"
                          >
                            {saving ? 'Saving...' : 'Save Changes'}
                          </Button>
                        </form>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="plants" className="mt-0">
                    <Card>
                      <CardHeader>
                        <CardTitle>Plant Preferences</CardTitle>
                        <CardDescription>Customize your plant viewing experience.</CardDescription>
                      </CardHeader>
                      <CardContent>
                        {message.text && (
                          <div className={`mb-4 p-4 rounded-lg flex items-center gap-2 ${
                            message.type === 'error' ? 'bg-red-50 text-red-800' : 'bg-green-50 text-green-800'
                          }`}>
                            {message.type === 'error' ? (
                              <AlertCircle className="w-5 h-5" />
                            ) : (
                              <CheckCircle className="w-5 h-5" />
                            )}
                            <span>{message.text}</span>
                          </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-6">
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <div className="space-y-0.5">
                                <Label>Show Admin Plants</Label>
                                <p className="text-sm text-gray-500">
                                  Display plants created by administrators
                                </p>
                              </div>
                              <Switch
                                checked={profile.show_admin_plants}
                                onCheckedChange={(checked) => {
                                  if (!checked) {
                                    setProfile({
                                      ...profile,
                                      show_admin_plants: false,
                                      show_admin_collections: false,
                                      show_admin_sightings: false
                                    });
                                  } else {
                                    setProfile({ ...profile, show_admin_plants: true });
                                  }
                                }}
                              />
                            </div>

                            <div className="flex items-center justify-between">
                              <div className="space-y-0.5">
                                <Label>Show Admin Collections</Label>
                                <p className="text-sm text-gray-500">
                                  Display collections created by administrators
                                </p>
                              </div>
                              <Switch
                                checked={profile.show_admin_collections}
                                onCheckedChange={(checked) => setProfile({ ...profile, show_admin_collections: checked })}
                                disabled={!profile.show_admin_plants}
                              />
                            </div>

                            <div className="flex items-center justify-between">
                              <div className="space-y-0.5">
                                <Label>Show Admin Sightings</Label>
                                <p className="text-sm text-gray-500">
                                  Display plant sightings from administrators
                                </p>
                              </div>
                              <Switch
                                checked={profile.show_admin_sightings}
                                onCheckedChange={(checked) => setProfile({ ...profile, show_admin_sightings: checked })}
                                disabled={!profile.show_admin_plants}
                              />
                            </div>
                          </div>

                          <Button
                            type="submit"
                            disabled={saving}
                            className="w-full"
                          >
                            {saving ? 'Saving...' : 'Save Changes'}
                          </Button>
                        </form>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </div>
              </div>
            </Tabs>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
} 