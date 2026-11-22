'use client';

import React from "react"

import { DashboardLayout } from '@/components/dashboard-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useState } from 'react';
import { Bell, X, Plus, MapPin, Clock } from 'lucide-react';
import { createAnnouncement } from '@/app/actions/communication';

interface Announcement {
  id: string;
  title: string;
  description: string;
  level: 'national' | 'district' | 'local';
  date: string;
  author: string;
}

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    level: 'local' as const,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newAnnouncement = await createAnnouncement(formData);
    setAnnouncements([newAnnouncement as Announcement, ...announcements]);
    setFormData({ title: '', description: '', level: 'local' });
    setShowForm(false);
  };

  const getLevelBadgeColor = (level: string) => {
    switch (level) {
      case 'national':
        return 'bg-primary/10 text-primary';
      case 'district':
        return 'bg-secondary/10 text-secondary';
      case 'local':
        return 'bg-green-100 text-green-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-foreground">Announcements</h1>
            <p className="text-foreground/70">Manage and view announcements across all levels</p>
          </div>
          <Button onClick={() => setShowForm(!showForm)} className="gap-2">
            <Plus className="w-4 h-4" />
            New Announcement
          </Button>
        </div>

        {/* Create Form */}
        {showForm && (
          <Card className="border border-border bg-primary/5">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle>Create New Announcement</CardTitle>
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
                  <Label htmlFor="title" className="text-foreground">Title</Label>
                  <Input
                    id="title"
                    name="title"
                    value={formData.title}
                    onChange={handleChange}
                    placeholder="Announcement title"
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
                    placeholder="Announcement details"
                    rows={4}
                    required
                    className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="level" className="text-foreground">Announcement Level</Label>
                  <select
                    id="level"
                    name="level"
                    value={formData.level}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    <option value="national">National</option>
                    <option value="district">District</option>
                    <option value="local">Local</option>
                  </select>
                </div>

                <div className="flex gap-2">
                  <Button type="submit">Post Announcement</Button>
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

        {/* Announcement Filters */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          <Button variant="outline" className="whitespace-nowrap bg-transparent">All Levels</Button>
          <Button variant="outline" className="whitespace-nowrap bg-transparent">National</Button>
          <Button variant="outline" className="whitespace-nowrap bg-transparent">District</Button>
          <Button variant="outline" className="whitespace-nowrap bg-transparent">Local</Button>
        </div>

        {/* Announcements List */}
        <div className="space-y-4">
          {announcements.length === 0 ? (
            <Card className="border border-border">
              <CardContent className="py-12 text-center">
                <Bell className="w-12 h-12 text-foreground/30 mx-auto mb-4" />
                <p className="text-foreground/70">No announcements yet</p>
              </CardContent>
            </Card>
          ) : (
            announcements.map((announcement) => (
              <Card
                key={announcement.id}
                className="border border-border hover:shadow-md transition-all cursor-pointer group"
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
                          {announcement.title}
                        </h3>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getLevelBadgeColor(announcement.level)}`}>
                          {announcement.level.charAt(0).toUpperCase() + announcement.level.slice(1)}
                        </span>
                      </div>
                      <p className="text-foreground/70 mb-3">{announcement.description}</p>
                      <div className="flex items-center gap-4 text-sm text-foreground/60">
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {announcement.date}
                        </span>
                        <span>By {announcement.author}</span>
                      </div>
                    </div>
                    <Button variant="outline" size="sm">View</Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
