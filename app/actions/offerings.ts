'use server'

import { getSupabaseUser, supabaseServer } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

async function getUserId() { return (await getSupabaseUser()).id }
export async function getOfferings() { const userId = await getUserId(); const { data, error } = await supabaseServer().from('offerings').select('*').eq('user_id', userId).order('created_at', { ascending: false }); if (error) throw new Error(error.message); return data ?? [] }
export async function createOffering(input: { amount: number; paymentMethod: string; purpose: string; donor?: string }) { const userId = await getUserId(); if (!Number.isFinite(input.amount) || input.amount <= 0) throw new Error('Invalid amount'); const { error } = await supabaseServer().from('offerings').insert({ id: crypto.randomUUID(), user_id: userId, amount: Math.round(input.amount * 100), payment_method: input.paymentMethod, purpose: input.purpose, donor: input.donor || null }); if (error) throw new Error(error.message); revalidatePath('/dashboard/offerings') }
export async function deleteOffering(id: string) { const userId = await getUserId(); const { error } = await supabaseServer().from('offerings').delete().eq('id', id).eq('user_id', userId); if (error) throw new Error(error.message); revalidatePath('/dashboard/offerings') }
