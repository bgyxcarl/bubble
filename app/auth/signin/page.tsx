"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ChevronLeft, LogIn, AlertTriangle } from "lucide-react"

export default function SignIn() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    })

    if (result?.error) {
      setError("Invalid credentials. Please try again.")
      setIsLoading(false)
    } else {
      router.push("/")
    }
  }

  const inputClass = "w-full bg-white border-2 border-black p-3 font-bold focus:outline-none focus:ring-4 focus:ring-yellow-200 focus:border-black transition-all placeholder:text-gray-400";
  const labelClass = "block text-xs font-black uppercase tracking-widest text-gray-500 mb-2";

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f0f0f0] p-4 font-sans relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-300 border-l-4 border-b-4 border-black rounded-bl-full -mr-16 -mt-16 z-0"></div>
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-500 border-r-4 border-t-4 border-black rounded-tr-full -ml-12 -mb-12 z-0"></div>

      <Link href="/" className="absolute top-6 left-6 flex items-center gap-2 font-black uppercase tracking-wider hover:underline z-10 bg-white border-2 border-black px-4 py-2 neo-shadow-hover transition-transform">
        <ChevronLeft className="stroke-[3]" size={18} />
        Main Menu
      </Link>

      <div className="max-w-md w-full relative z-10">
        <div className="bg-white border-4 border-black neo-shadow-lg p-8 relative">
          <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-black text-white border-2 border-white px-6 py-2 shadow-lg">
            <LogIn size={32} />
          </div>

          <div className="mt-6 text-center mb-8">
            <h2 className="text-4xl font-black uppercase tracking-tighter italic">Welcome Back</h2>
            <p className="text-gray-500 font-bold mt-2 font-mono text-sm">Enter your credentials to access the bubble.</p>
          </div>

          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div>
                <label htmlFor="email" className={labelClass}>
                  Email Address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  className={inputClass}
                  placeholder="USER@EXAMPLE.COM"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="password" className={labelClass}>
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  className={inputClass}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-100 border-2 border-black p-3 text-red-700 text-sm font-bold flex items-center gap-2 neo-shadow-sm">
                <AlertTriangle size={18} /> {error}
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center py-4 px-4 border-2 border-black text-sm font-black uppercase tracking-widest text-white bg-blue-600 hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black neo-shadow-hover transition-all disabled:opacity-50 hover:translate-x-[-2px] hover:translate-y-[-2px]"
              >
                {isLoading ? "Authenticating..." : "Sign In Now"}
              </button>
            </div>
          </form>

          <div className="mt-8 pt-6 border-t-4 border-gray-100 text-center">
            <p className="text-sm font-bold text-gray-500 uppercase tracking-wide">
              New here?{" "}
              <Link
                href="/auth/register"
                className="font-black text-black underline hover:text-blue-600 decoration-2 underline-offset-2"
              >
                Create Account
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}