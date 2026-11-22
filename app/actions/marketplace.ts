'use server'

import { getSupabaseUser, supabaseServer } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

async function getUserId() { return (await getSupabaseUser()).id }
export async function getProducts() { const userId = await getUserId(); const { data, error } = await supabaseServer().from('products').select('*').eq('user_id', userId).order('created_at', { ascending: false }); if (error) throw new Error(error.message); return data ?? [] }
export async function createProduct(input: { name: string; description: string; price: number; category: string; inStock: number }) { const userId = await getUserId(); if (!input.name.trim() || !input.description.trim() || !Number.isFinite(input.price) || input.price < 0 || !Number.isInteger(input.inStock) || input.inStock < 0) throw new Error('Invalid product'); const { error } = await supabaseServer().from('products').insert({ id: crypto.randomUUID(), user_id: userId, name: input.name.trim(), description: input.description.trim(), price: Math.round(input.price * 100), category: input.category, in_stock: input.inStock }); if (error) throw new Error(error.message); revalidatePath('/dashboard/marketplace') }
export async function deleteProduct(id: string) { const userId = await getUserId(); const { error } = await supabaseServer().from('products').delete().eq('id', id).eq('user_id', userId); if (error) throw new Error(error.message); revalidatePath('/dashboard/marketplace') }
