"use client"

import { useSearchParams } from "next/navigation"
import Link from "next/link"

export default function AuthError() {
  const searchParams = useSearchParams()
  const error = searchParams.get("error")

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Authentication Error
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            {error === "CredentialsSignin" && "Invalid email or password"}
            {error === "EmailSignin" && "Check your email for the sign in link"}
            {error === "OAuthSignin" && "Error signing in with OAuth provider"}
            {error === "OAuthCallback" && "Error in OAuth callback"}
            {error === "OAuthCreateAccount" && "Could not create account with OAuth provider"}
            {error === "EmailCreateAccount" && "Could not create account with email"}
            {error === "Callback" && "Error in callback URL"}
            {error === "OAuthAccountNotLinked" && "To confirm your identity, sign in with the same account you used originally"}
            {error === "SessionRequired" && "Please sign in to access this page"}
            {!error && "An unknown error occurred"}
          </p>
        </div>
        <div className="text-center">
          <Link
            href="/auth/signin"
            className="font-medium text-indigo-600 hover:text-indigo-500"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  )
}