'use client';

import React from "react"
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

import { DashboardLayout } from '@/components/dashboard-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useState } from 'react';
import { ShoppingBag, Plus, X, Search, Star, ShoppingCart, DollarSign, Package } from 'lucide-react';
import { createProduct } from '@/app/actions/marketplace';

interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  category: 'uniform' | 'book' | 'guide' | 'other';
  image: string;
  rating: number;
  reviews: number;
  inStock: number;
}

function MarketplacePageComponent() {
  const [products, setProducts] = useState<Product[]>([]);

  const [showForm, setShowForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<'all' | 'uniform' | 'book' | 'guide' | 'other'>('all');
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    category: 'other' as const,
    inStock: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createProduct({ name: formData.name, description: formData.description, price: Number(formData.price), category: formData.category, inStock: Number(formData.inStock) });
    const newProduct: Product = {
      id: Math.max(...products.map((p) => p.id), 0) + 1,
      name: formData.name,
      description: formData.description,
      price: parseFloat(formData.price),
      category: formData.category,
      image: formData.name.split(' ').slice(0, 2).map((w) => w[0]).join(''),
      rating: 5,
      reviews: 0,
      inStock: parseInt(formData.inStock),
    };
    setProducts([...products, newProduct]);
    setFormData({ name: '', description: '', price: '', category: 'other', inStock: '' });
    setShowForm(false);
  };

  const filteredProducts = products.filter((product) => {
    const matchesSearch =
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterCategory === 'all' || product.category === filterCategory;
    return matchesSearch && matchesFilter;
  });

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'uniform':
        return 'bg-primary/10 text-primary';
      case 'book':
        return 'bg-secondary/10 text-secondary';
      case 'guide':
        return 'bg-purple-100 text-purple-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const totalRevenue = products.reduce((sum, p) => sum + p.price * p.inStock, 0);
  const totalProducts = products.length;
  const totalInStock = products.reduce((sum, p) => sum + p.inStock, 0);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground">Marketplace</h1>
          <p className="text-foreground/70">Manage and sell products to your community</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="gap-2">
          <Plus className="w-4 h-4" />
          Add Product
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border border-border">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-foreground/70">Total Products</p>
                <p className="text-3xl font-bold text-foreground mt-2">{totalProducts}</p>
              </div>
              <div className="p-3 rounded-lg bg-primary/10">
                <Package className="w-6 h-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-foreground/70">Items in Stock</p>
                <p className="text-3xl font-bold text-foreground mt-2">{totalInStock}</p>
              </div>
              <div className="p-3 rounded-lg bg-secondary/10">
                <ShoppingBag className="w-6 h-6 text-secondary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-foreground/70">Inventory Value</p>
                <p className="text-3xl font-bold text-foreground mt-2">${totalRevenue.toFixed(2)}</p>
              </div>
              <div className="p-3 rounded-lg bg-green-100">
                <DollarSign className="w-6 h-6 text-green-700" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add Product Form */}
      {showForm && (
        <Card className="border border-border bg-primary/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>Add New Product</CardTitle>
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
                <Label htmlFor="name" className="text-foreground">Product Name</Label>
                <Input
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Product name"
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
                  placeholder="Product description"
                  rows={3}
                  required
                  className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price" className="text-foreground">Price ($)</Label>
                  <Input
                    id="price"
                    name="price"
                    type="number"
                    step="0.01"
                    value={formData.price}
                    onChange={handleChange}
                    placeholder="0.00"
                    required
                    className="border-border"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category" className="text-foreground">Category</Label>
                  <select
                    id="category"
                    name="category"
                    value={formData.category}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    <option value="uniform">Uniform</option>
                    <option value="book">Book</option>
                    <option value="guide">Study Guide</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="inStock" className="text-foreground">Stock Quantity</Label>
                  <Input
                    id="inStock"
                    name="inStock"
                    type="number"
                    value={formData.inStock}
                    onChange={handleChange}
                    placeholder="0"
                    required
                    className="border-border"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button type="submit">Add Product</Button>
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
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 border-border"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto">
          <Button
            variant={filterCategory === 'all' ? 'default' : 'outline'}
            onClick={() => setFilterCategory('all')}
            size="sm"
          >
            All
          </Button>
          <Button
            variant={filterCategory === 'uniform' ? 'default' : 'outline'}
            onClick={() => setFilterCategory('uniform')}
            size="sm"
          >
            Uniforms
          </Button>
          <Button
            variant={filterCategory === 'book' ? 'default' : 'outline'}
            onClick={() => setFilterCategory('book')}
            size="sm"
          >
            Books
          </Button>
          <Button
            variant={filterCategory === 'guide' ? 'default' : 'outline'}
            onClick={() => setFilterCategory('guide')}
            size="sm"
          >
            Guides
          </Button>
        </div>
      </div>

      {/* Products Grid */}
      {filteredProducts.length === 0 ? (
        <Card className="border border-border">
          <CardContent className="py-12 text-center">
            <ShoppingBag className="w-12 h-12 text-foreground/30 mx-auto mb-4" />
            <p className="text-foreground/70">No products found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.map((product) => (
            <Card
              key={product.id}
              className="border border-border hover:shadow-lg transition-all overflow-hidden group"
            >
              {/* Product Image Area */}
              <div className="h-40 bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center relative group-hover:from-primary/30 group-hover:to-secondary/30 transition-all">
                <div className="w-24 h-24 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold text-xl">
                  {product.image}
                </div>
              </div>

              <CardContent className="p-4">
                {/* Product Category */}
                <span className={`inline-block px-2 py-1 rounded text-xs font-medium mb-2 ${getCategoryColor(product.category)}`}>
                  {product.category === 'guide' ? 'Study Guide' : product.category.charAt(0).toUpperCase() + product.category.slice(1)}
                </span>

                {/* Product Name */}
                <h3 className="font-bold text-foreground mb-2 line-clamp-2 group-hover:text-primary transition-colors">
                  {product.name}
                </h3>

                {/* Product Description */}
                <p className="text-sm text-foreground/70 mb-3 line-clamp-2">{product.description}</p>

                {/* Price and Rating */}
                <div className="flex items-center justify-between mb-4 pb-4 border-b border-border">
                  <p className="text-lg font-bold text-primary">${product.price.toFixed(2)}</p>
                  <div className="flex items-center gap-1 text-xs text-foreground/60">
                    <Star className="w-4 h-4 fill-current" />
                    {product.rating} ({product.reviews})
                  </div>
                </div>

                {/* Stock Info */}
                <p className="text-xs text-foreground/60 mb-4">
                  <span className={product.inStock > 10 ? 'text-green-600' : product.inStock > 0 ? 'text-yellow-600' : 'text-red-600'}>
                    {product.inStock} in stock
                  </span>
                </p>

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1 gap-2 bg-transparent" size="sm">
                    <ShoppingCart className="w-4 h-4" />
                    Buy
                  </Button>
                  <Button size="sm" className="flex-1">Edit</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MarketplacePage() {
  return (
    <DashboardLayout>
      <Suspense fallback={null}>
        <MarketplacePageComponent />
      </Suspense>
    </DashboardLayout>
  );
}
