import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name) => req.cookies.get(name)?.value,
        set: (name, value, options) => {
          res.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove: (name, options) => {
          res.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  const {
    data: { session },
  } = await supabase.auth.getSession()

  // Don't redirect if we're on the auth callback route
  if (req.nextUrl.pathname.startsWith('/auth/callback')) {
    return res
  }

  // Check for admin access to dashboard
  if (req.nextUrl.pathname.startsWith('/dashboard')) {
    if (!session?.user) {
      // Not logged in - redirect to home
      const redirectUrl = new URL('/', req.url)
      redirectUrl.searchParams.set('redirectedFrom', req.nextUrl.pathname)
      return NextResponse.redirect(redirectUrl)
    }
    // Allow access to all authenticated users
    return res
  }

  // If user is signed in and on home page with redirect param
  if (session?.user && req.nextUrl.pathname === '/' && req.nextUrl.searchParams.has('redirectedFrom')) {
    const redirectTo = req.nextUrl.searchParams.get('redirectedFrom')
    if (redirectTo) {
      return NextResponse.redirect(new URL(redirectTo, req.url))
    }
  }

  return res
}

export const config = {
  matcher: ['/', '/dashboard/:path*', '/auth/callback'],
} 