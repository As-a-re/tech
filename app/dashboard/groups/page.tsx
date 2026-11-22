'use client';

import React from "react"
import { Suspense } from 'react';

import { DashboardLayout } from '@/components/dashboard-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useState } from 'react';
import { Users, Plus, X, Search, Lock, Globe, UserPlus, MessageCircle } from 'lucide-react';
import Link from 'next/link';
import { createGroup } from '@/app/actions/groups';

interface Group {
  id: string;
  name: string;
  description: string;
  members: number;
  visibility: 'public' | 'private';
  image: string;
  posts: number;
  createdAt?: Date;
}

const Loading = () => null;

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);

  const [showForm, setShowForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterVisibility, setFilterVisibility] = useState<'all' | 'public' | 'private'>('all');
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    visibility: 'public' as const,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newGroup = await createGroup(formData);
    setGroups((current) => [newGroup as Group, ...current]);
    setFormData({ name: '', description: '', visibility: 'public' });
    setShowForm(false);
  };

  const filteredGroups = groups.filter((group) => {
    const matchesSearch =
      group.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      group.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterVisibility === 'all' || group.visibility === filterVisibility;
    return matchesSearch && matchesFilter;
  });

  return (
    <DashboardLayout user={{ name: 'Account', email: '' }}>
      <Suspense fallback={<Loading />}>
        <div className="space-y-6">
          {/* Page Header */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-2">
              <h1 className="text-3xl font-bold text-foreground">Community Groups</h1>
              <p className="text-foreground/70">Organize and manage your community groups</p>
            </div>
            <Button onClick={() => setShowForm(!showForm)} className="gap-2">
              <Plus className="w-4 h-4" />
              Create Group
            </Button>
          </div>

          {/* Create Group Form */}
          {showForm && (
            <Card className="border border-border bg-primary/5">
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle>Create New Group</CardTitle>
                <button
                  onClick={() => setShowForm(false)}
                  className="text-foreground/50 hover:text-foreground transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-foreground">Group Name</Label>
                    <Input
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      placeholder="e.g., Youth Ministry"
                      required
                      className="border-border"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description" className="text-foreground">Description</Label>
                    <textarea
                      id="description"
                      name="description"
                      value={formData.description}
                      onChange={handleChange}
                      placeholder="What is this group about?"
                      rows={4}
                      required
                      className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="visibility" className="text-foreground">Visibility</Label>
                    <select
                      id="visibility"
                      name="visibility"
                      value={formData.visibility}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                    >
                      <option value="public">Public (Anyone can join)</option>
                      <option value="private">Private (Invite only)</option>
                    </select>
                  </div>

                  <div className="flex gap-2">
                    <Button type="submit">Create Group</Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowForm(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Search and Filter */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/50" />
              <Input
                type="text"
                placeholder="Search groups..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 border-border"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant={filterVisibility === 'all' ? 'default' : 'outline'}
                onClick={() => setFilterVisibility('all')}
              >
                All
              </Button>
              <Button
                variant={filterVisibility === 'public' ? 'default' : 'outline'}
                onClick={() => setFilterVisibility('public')}
                className="gap-2"
              >
                <Globe className="w-4 h-4" />
                Public
              </Button>
              <Button
                variant={filterVisibility === 'private' ? 'default' : 'outline'}
                onClick={() => setFilterVisibility('private')}
                className="gap-2"
              >
                <Lock className="w-4 h-4" />
                Private
              </Button>
            </div>
          </div>

          {/* Groups Grid */}
          {filteredGroups.length === 0 ? (
            <Card className="border border-border">
              <CardContent className="py-12 text-center">
                <Users className="w-12 h-12 text-foreground/30 mx-auto mb-4" />
                <p className="text-foreground/70">No groups found</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredGroups.map((group) => (
                <Card
                  key={group.id}
                  className="border border-border hover:shadow-lg transition-all cursor-pointer overflow-hidden group"
                >
                  {/* Group Header */}
                  <div className="h-20 bg-gradient-to-r from-primary to-secondary relative" />

                  <CardContent className="p-6 -mt-10 relative z-10">
                    {/* Group Avatar */}
                    <div className="mb-4">
                      <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold text-lg mb-4">
                        {group.image}
                      </div>
                    </div>

                    {/* Group Info */}
                    <h3 className="text-lg font-bold text-foreground mb-2 group-hover:text-primary transition-colors">
                      {group.name}
                    </h3>
                    <p className="text-sm text-foreground/70 mb-4 line-clamp-2">{group.description}</p>

                    {/* Stats */}
                    <div className="flex items-center gap-4 text-xs text-foreground/60 mb-4 pb-4 border-b border-border">
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {group.members} members
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageCircle className="w-3 h-3" />
                        {group.posts} posts
                      </span>
                    </div>

                    {/* Visibility */}
                    <div className="flex items-center justify-between">
                      <span className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                        group.visibility === 'public'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {group.visibility === 'public' ? (
                          <>
                            <Globe className="w-3 h-3" />
                            Public
                          </>
                        ) : (
                          <>
                            <Lock className="w-3 h-3" />
                            Private
                          </>
                        )}
                      </span>
                      <Button size="sm" variant="outline" className="gap-1 bg-transparent">
                        <UserPlus className="w-3 h-3" />
                        Join
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </Suspense>
    </DashboardLayout>
  );
}
