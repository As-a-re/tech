'use client';

import React from "react"

import { DashboardLayout } from '@/components/dashboard-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useState } from 'react';
import { Heart, TrendingUp, Users, Calendar, CreditCard, Plus, X } from 'lucide-react';
import { createOffering } from '@/app/actions/offerings';

interface Offering {
  id: string;
  date: string;
  amount: number;
  paymentMethod: string;
  donor: string;
  purpose: string;
}

interface OfferingStats {
  totalCollected: number;
  thisMonth: number;
  thisWeek: number;
  averageOffering: number;
  totalDonors: number;
}

export default function OfferingsPage() {
  const [offerings, setOfferings] = useState<Offering[]>([]);

  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    amount: '',
    paymentMethod: 'card',
    purpose: 'general',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(formData.amount);
    await createOffering({ amount, paymentMethod: formData.paymentMethod, purpose: formData.purpose, donor: 'Account owner' });
    setOfferings([{ id: crypto.randomUUID(), date: new Date().toISOString().split('T')[0], amount, paymentMethod: formData.paymentMethod, donor: 'Account owner', purpose: formData.purpose }, ...offerings]);
    setFormData({ amount: '', paymentMethod: 'card', purpose: 'general' });
    setShowForm(false);
  };

  const stats: OfferingStats = {
    totalCollected: offerings.reduce((sum, o) => sum + o.amount, 0),
    thisMonth: offerings.reduce((sum, o) => {
      const isThisMonth = o.date.includes('2024-01');
      return isThisMonth ? sum + o.amount : sum;
    }, 0),
    thisWeek: offerings.slice(0, 4).reduce((sum, o) => sum + o.amount, 0),
    averageOffering:
      offerings.length > 0
        ? Math.round(offerings.reduce((sum, o) => sum + o.amount, 0) / offerings.length)
        : 0,
    totalDonors: offerings.length,
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-6xl">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-foreground">Offerings & Giving</h1>
            <p className="text-foreground/70">Manage donations and track giving patterns</p>
          </div>
          <Button onClick={() => setShowForm(!showForm)} className="gap-2">
            <Plus className="w-4 h-4" />
            Record Offering
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card className="border border-border">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-foreground/70 uppercase font-semibold">Total Collected</p>
                  <p className="text-2xl font-bold text-primary mt-2">${stats.totalCollected.toFixed(2)}</p>
                </div>
                <Heart className="w-5 h-5 text-primary" />
              </div>
            </CardContent>
          </Card>

          <Card className="border border-border">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-foreground/70 uppercase font-semibold">This Month</p>
                  <p className="text-2xl font-bold text-secondary mt-2">${stats.thisMonth.toFixed(2)}</p>
                </div>
                <Calendar className="w-5 h-5 text-secondary" />
              </div>
            </CardContent>
          </Card>

          <Card className="border border-border">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-foreground/70 uppercase font-semibold">This Week</p>
                  <p className="text-2xl font-bold text-primary mt-2">${stats.thisWeek.toFixed(2)}</p>
                </div>
                <TrendingUp className="w-5 h-5 text-primary" />
              </div>
            </CardContent>
          </Card>

          <Card className="border border-border">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-foreground/70 uppercase font-semibold">Avg. Offering</p>
                  <p className="text-2xl font-bold text-secondary mt-2">${stats.averageOffering.toFixed(2)}</p>
                </div>
                <CreditCard className="w-5 h-5 text-secondary" />
              </div>
            </CardContent>
          </Card>

          <Card className="border border-border">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-foreground/70 uppercase font-semibold">Donors</p>
                  <p className="text-2xl font-bold text-primary mt-2">{stats.totalDonors}</p>
                </div>
                <Users className="w-5 h-5 text-primary" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Record Offering Form */}
        {showForm && (
          <Card className="border border-border bg-primary/5">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle>Record New Offering</CardTitle>
              <button
                onClick={() => setShowForm(false)}
                className="text-foreground/50 hover:text-foreground transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="amount" className="text-foreground">Amount ($)</Label>
                    <Input
                      id="amount"
                      name="amount"
                      type="number"
                      step="0.01"
                      value={formData.amount}
                      onChange={handleChange}
                      placeholder="0.00"
                      required
                      className="border-border"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="paymentMethod" className="text-foreground">Payment Method</Label>
                    <select
                      id="paymentMethod"
                      name="paymentMethod"
                      value={formData.paymentMethod}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                    >
                      <option value="card">Credit/Debit Card</option>
                      <option value="bank">Bank Transfer</option>
                      <option value="cash">Cash</option>
                      <option value="mobile">Mobile Payment</option>
                      <option value="check">Check</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="purpose" className="text-foreground">Purpose</Label>
                  <select
                    id="purpose"
                    name="purpose"
                    value={formData.purpose}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    <option value="general">General Offering</option>
                    <option value="building">Building Fund</option>
                    <option value="missions">Missions</option>
                    <option value="outreach">Outreach</option>
                    <option value="benevolence">Benevolence</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div className="flex gap-2">
                  <Button type="submit">Record Offering</Button>
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

        {/* Offering Purposes */}
        <Card className="border border-border">
          <CardHeader>
            <CardTitle>Offering By Purpose</CardTitle>
            <CardDescription>Distribution of offerings</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { label: 'General Offering', amount: 625, color: 'bg-primary' },
                { label: 'Building Fund', amount: 200, color: 'bg-secondary' },
                { label: 'Missions', amount: 100, color: 'bg-purple-500' },
              ].map((item, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-foreground font-medium">{item.label}</span>
                    <span className="text-foreground/70">${item.amount}</span>
                  </div>
                  <div className="w-full bg-border rounded-full h-2 overflow-hidden">
                    <div
                      className={`${item.color} h-full transition-all`}
                      style={{
                        width: `${(item.amount / stats.totalCollected) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Offerings */}
        <Card className="border border-border">
          <CardHeader>
            <CardTitle>Recent Offerings</CardTitle>
            <CardDescription>Latest giving transactions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 text-xs font-semibold text-foreground/70">Date</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-foreground/70">Donor</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-foreground/70">Amount</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-foreground/70">Purpose</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-foreground/70">Method</th>
                  </tr>
                </thead>
                <tbody>
                  {offerings.map((offering) => (
                    <tr key={offering.id} className="border-b border-border hover:bg-primary/5 transition-colors">
                      <td className="py-3 px-4 text-sm text-foreground">{offering.date}</td>
                      <td className="py-3 px-4 text-sm text-foreground">{offering.donor}</td>
                      <td className="py-3 px-4 text-sm font-semibold text-primary">${offering.amount.toFixed(2)}</td>
                      <td className="py-3 px-4 text-sm text-foreground/70">{offering.purpose}</td>
                      <td className="py-3 px-4 text-sm text-foreground/70">{offering.paymentMethod}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
