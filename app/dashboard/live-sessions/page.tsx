'use client';

import React from "react"

import { DashboardLayout } from '@/components/dashboard-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useState } from 'react';
import { Zap, Plus, X, Users, Clock, Video, Play, Radio, Calendar } from 'lucide-react';
import { createLiveSession } from '@/app/actions/communication';

interface LiveSession {
  id: string;
  title: string;
  description: string;
  startTime: string;
  endTime?: string;
  host: string;
  status: 'upcoming' | 'live' | 'ended';
  viewers: number;
  platform: string;
}

export default function LiveSessionsPage() {
  const [sessions, setSessions] = useState<LiveSession[]>([]);

  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    startTime: '',
    host: '',
    platform: 'youtube',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newSession = await createLiveSession(formData);
    setSessions([newSession as LiveSession, ...sessions]);
    setFormData({ title: '', description: '', startTime: '', host: '', platform: 'youtube' });
    setShowForm(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'live':
        return 'bg-red-100 text-red-700';
      case 'upcoming':
        return 'bg-blue-100 text-blue-700';
      case 'ended':
        return 'bg-gray-100 text-gray-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const liveCount = sessions.filter((s) => s.status === 'live').length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-foreground">Live Sessions</h1>
            <p className="text-foreground/70">Host and manage live streams and events</p>
          </div>
          <Button onClick={() => setShowForm(!showForm)} className="gap-2">
            <Plus className="w-4 h-4" />
            Schedule Session
          </Button>
        </div>

        {/* Live Status Banner */}
        {liveCount > 0 && (
          <Card className="border border-red-200 bg-red-50">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-100 animate-pulse">
                <Radio className="w-6 h-6 text-red-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-red-700">{liveCount} Session(s) Currently Live</h3>
                <p className="text-sm text-red-600">Click below to join viewers</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Create Session Form */}
        {showForm && (
          <Card className="border border-border bg-primary/5">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle>Schedule New Session</CardTitle>
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
                  <Label htmlFor="title" className="text-foreground">Session Title</Label>
                  <Input
                    id="title"
                    name="title"
                    value={formData.title}
                    onChange={handleChange}
                    placeholder="e.g., Sunday Service"
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
                    placeholder="Session details"
                    rows={3}
                    className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="startTime" className="text-foreground">Start Date & Time</Label>
                    <Input
                      id="startTime"
                      name="startTime"
                      type="datetime-local"
                      value={formData.startTime}
                      onChange={handleChange}
                      required
                      className="border-border"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="host" className="text-foreground">Host Name</Label>
                    <Input
                      id="host"
                      name="host"
                      value={formData.host}
                      onChange={handleChange}
                      placeholder="e.g., Pastor John"
                      required
                      className="border-border"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="platform" className="text-foreground">Platform</Label>
                  <select
                    id="platform"
                    name="platform"
                    value={formData.platform}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    <option value="youtube">YouTube Live</option>
                    <option value="facebook">Facebook Live</option>
                    <option value="zoom">Zoom</option>
                    <option value="other">Other Platform</option>
                  </select>
                </div>

                <div className="flex gap-2">
                  <Button type="submit">Schedule Session</Button>
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

        {/* Sessions List */}
        <div className="space-y-4">
          {/* Live Sessions */}
          {sessions.filter((s) => s.status === 'live').length > 0 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-foreground">Now Live</h2>
              {sessions
                .filter((s) => s.status === 'live')
                .map((session) => (
                  <Card
                    key={session.id}
                    className="border-2 border-red-200 bg-red-50/50 hover:shadow-lg transition-all"
                  >
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between gap-4 mb-4">
                        <div className="flex items-start gap-4 flex-1">
                          <div className="flex items-center justify-center w-16 h-16 rounded-lg bg-red-200 animate-pulse">
                            <Video className="w-8 h-8 text-red-600" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="text-lg font-bold text-foreground">{session.title}</h3>
                              <span className={`px-2 py-1 rounded text-xs font-semibold ${getStatusColor(session.status)}`}>
                                LIVE
                              </span>
                            </div>
                            <p className="text-foreground/70 mb-2">{session.description}</p>
                            <div className="flex items-center gap-4 text-sm text-foreground/60">
                              <span className="flex items-center gap-1">
                                <Users className="w-4 h-4" />
                                {session.viewers.toLocaleString()} watching
                              </span>
                              <span className="flex items-center gap-1">
                                <Video className="w-4 h-4" />
                                {session.platform}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <Button className="gap-2 w-full md:w-auto">
                        <Play className="w-4 h-4" />
                        Join Live Stream
                      </Button>
                    </CardContent>
                  </Card>
                ))}
            </div>
          )}

          {/* Upcoming Sessions */}
          {sessions.filter((s) => s.status === 'upcoming').length > 0 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-foreground">Upcoming</h2>
              {sessions
                .filter((s) => s.status === 'upcoming')
                .map((session) => (
                  <Card key={session.id} className="border border-border hover:shadow-md transition-all">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-4 flex-1">
                          <div className="flex items-center justify-center w-16 h-16 rounded-lg bg-blue-100">
                            <Calendar className="w-8 h-8 text-blue-600" />
                          </div>
                          <div className="flex-1">
                            <h3 className="text-lg font-bold text-foreground mb-1">{session.title}</h3>
                            <p className="text-foreground/70 mb-3">{session.description}</p>
                            <div className="flex items-center gap-4 text-sm text-foreground/60 flex-wrap">
                              <span className="flex items-center gap-1">
                                <Clock className="w-4 h-4" />
                                {session.startTime}
                              </span>
                              <span className="flex items-center gap-1">
                                <Video className="w-4 h-4" />
                                {session.platform}
                              </span>
                              <span>Host: {session.host}</span>
                            </div>
                          </div>
                        </div>
                        <Button variant="outline">Set Reminder</Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
          )}

          {/* Past Sessions */}
          {sessions.filter((s) => s.status === 'ended').length > 0 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-foreground">Past Sessions</h2>
              {sessions
                .filter((s) => s.status === 'ended')
                .map((session) => (
                  <Card key={session.id} className="border border-border opacity-75 hover:opacity-100 transition-opacity">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-4 flex-1">
                          <div className="flex items-center justify-center w-16 h-16 rounded-lg bg-gray-100">
                            <Video className="w-8 h-8 text-gray-600" />
                          </div>
                          <div className="flex-1">
                            <h3 className="text-lg font-bold text-foreground/70 mb-1">{session.title}</h3>
                            <p className="text-foreground/60 mb-2">{session.description}</p>
                            <div className="flex items-center gap-4 text-sm text-foreground/50">
                              <span>{session.endTime}</span>
                              <span>{session.viewers.toLocaleString()} watched</span>
                            </div>
                          </div>
                        </div>
                        <Button variant="outline" size="sm">Watch Recording</Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
