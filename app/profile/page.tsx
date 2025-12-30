"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { ArrowLeft, User, Mail, Calendar, Settings, Edit, Save, Lock, X, Shield, AlertTriangle } from "lucide-react"

export default function Profile() {
  const { data: session, status, update } = useSession()
  const router = useRouter()
  const [isEditing, setIsEditing] = useState(false)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState("")

  // Password change modal
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [passwordError, setPasswordError] = useState("")

  useEffect(() => {
    if (status === "loading") return
    if (!session) router.push("/auth/signin")
  }, [session, status, router])

  useEffect(() => {
    if (session) {
      setName(session.user?.name || "")
      setEmail(session.user?.email || "")
    }
  }, [session])

  const handleSave = async () => {
    setIsLoading(true)
    setMessage("")

    try {
      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name }),
      })

      const data = await response.json()

      if (response.ok) {
        setMessage("个人信息更新成功")
        setIsEditing(false)
        // Trigger a session update
        await update({ name })
      } else {
        setMessage(data.error || "更新失败")
      }
    } catch (error) {
      setMessage("网络错误，请重试")
    } finally {
      setIsLoading(false)
    }
  }

  const handlePasswordChange = async () => {
    if (newPassword !== confirmPassword) {
      setPasswordError("新密码和确认密码不匹配")
      return
    }

    if (newPassword.length < 6) {
      setPasswordError("新密码至少需要6个字符")
      return
    }

    setIsLoading(true)
    setPasswordError("")

    try {
      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setMessage("密码修改成功")
        setShowPasswordModal(false)
        setCurrentPassword("")
        setNewPassword("")
        setConfirmPassword("")
      } else {
        setPasswordError(data.error || "密码修改失败")
      }
    } catch (error) {
      setPasswordError("网络错误，请重试")
    } finally {
      setIsLoading(false)
    }
  }

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-yellow-50">
        <div className="text-2xl font-black uppercase tracking-widest animate-pulse">Loading Profile...</div>
      </div>
    )
  }

  if (!session) {
    return null
  }

  // Common styles
  const cardClass = "bg-white border-4 border-black neo-shadow p-6 mb-8 relative";
  const labelClass = "block text-xs font-black uppercase tracking-widest text-gray-500 mb-2";
  const inputClass = "w-full bg-white border-2 border-black p-3 font-bold focus:outline-none focus:ring-4 focus:ring-yellow-200 focus:border-black transition-all";
  const btnPrimary = "inline-flex items-center justify-center px-6 py-3 bg-black text-white font-black uppercase tracking-widest border-2 border-black neo-shadow-hover hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all disabled:opacity-50 disabled:cursor-not-allowed";
  const btnSecondary = "inline-flex items-center justify-center px-6 py-3 bg-white text-black font-black uppercase tracking-widest border-2 border-black neo-shadow-hover hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all";

  return (
    <div className="min-h-screen bg-[#f0f0f0] font-sans pb-20">
      {/* Header */}
      <header className="bg-white border-b-4 border-black mb-12 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center gap-6">
              <button
                onClick={() => router.push("/")}
                className="flex items-center gap-2 font-bold uppercase tracking-wider hover:underline"
              >
                <ArrowLeft size={24} className="stroke-[3]" />
                Back
              </button>
              <h1 className="text-3xl font-black uppercase tracking-tighter italic">Personal Center</h1>
            </div>
            <div className="hidden sm:block">
              <div className="bg-yellow-300 border-2 border-black px-3 py-1 text-xs font-black uppercase rotate-[-2deg] shadow-sm">
                Member Area
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Profile Card */}
        <div className={cardClass}>
          <div className="absolute -top-4 -left-2 bg-blue-600 text-white border-2 border-black px-4 py-1 font-black uppercase tracking-widest transform -rotate-1 shadow-sm">
            Identity
          </div>

          <div className="mt-4 border-b-4 border-black pb-6 mb-6 flex justify-between items-end">
            <div>
              <h3 className="text-2xl font-black uppercase">Profile Information</h3>
              <p className="mt-1 text-sm font-mono text-gray-600 font-bold">Manage your account credentials and public identity.</p>
            </div>
            <User size={48} className="text-gray-200 stroke-[1.5]" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <label className={labelClass}>
                <span className="flex items-center gap-2"><User size={16} /> Display Name</span>
              </label>
              <div className="relative">
                {isEditing ? (
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={inputClass}
                  />
                ) : (
                  <div className={`p-3 border-2 border-transparent font-bold text-lg border-b-gray-200 border-b-2 bg-gray-50`}>
                    {session.user?.name || "Not Set"}
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className={labelClass}>
                <span className="flex items-center gap-2"><Mail size={16} /> Email Address</span>
              </label>
              <div className="relative">
                <div className="p-3 border-2 border-gray-100 bg-gray-50 font-mono text-gray-500 font-bold select-all">
                  {session.user?.email || "No Email"}
                </div>
                {isEditing && (
                  <div className="absolute right-2 top-2">
                    <input
                      type="email"
                      value={email}
                      disabled
                      className="hidden" // Email editing usually disabled or requires re-verification
                    />
                    <span className="text-[10px] font-black bg-gray-200 px-2 py-1 uppercase">Locked</span>
                  </div>
                )}
              </div>
            </div>

            <div className="md:col-span-2">
              <label className={labelClass}>
                <span className="flex items-center gap-2"><Calendar size={16} /> Member Since</span>
              </label>
              <div className="font-mono text-sm font-bold bg-green-100 inline-block px-3 py-1 border-2 border-black border-dashed">
                {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-8 pt-6 border-t-4 border-gray-100 flex gap-4">
            {isEditing ? (
              <>
                <button
                  onClick={handleSave}
                  disabled={isLoading}
                  className={`${btnPrimary} bg-blue-600`}
                >
                  <Save size={18} className="mr-2" />
                  {isLoading ? "Saving..." : "Save Changes"}
                </button>
                <button
                  onClick={() => setIsEditing(false)}
                  className={btnSecondary}
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className={btnPrimary}
              >
                <Edit size={18} className="mr-2" />
                Edit Profile
              </button>
            )}
          </div>

          {/* Success/Error Messages */}
          {message && (
            <div className={`mt-6 p-4 border-2 border-black font-bold flex items-center gap-3 ${message.includes("成功") ? "bg-green-400 text-black" : "bg-red-500 text-white"}`}>
              {message.includes("成功") ? <Shield size={20} /> : <AlertTriangle size={20} />}
              {message}
            </div>
          )}
        </div>

        {/* Security Card */}
        <div className={cardClass}>
          <div className="absolute -top-4 -right-2 bg-red-500 text-white border-2 border-black px-4 py-1 font-black uppercase tracking-widest transform rotate-1 shadow-sm">
            Security
          </div>

          <div className="mt-2 border-b-4 border-black pb-6 mb-6">
            <h3 className="text-2xl font-black uppercase">Account Security</h3>
            <p className="mt-1 text-sm font-mono text-gray-600 font-bold">Protect your assets and data.</p>
          </div>

          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 border-2 border-black hover:bg-gray-50 transition-colors">
              <div>
                <h4 className="text-lg font-black uppercase">Password</h4>
                <p className="text-xs text-gray-500 font-mono">Last changed: Never</p>
              </div>
              <button
                onClick={() => setShowPasswordModal(true)}
                className={`${btnSecondary} px-4 py-2 text-xs`}
              >
                <Lock size={14} className="mr-2" />
                Change
              </button>
            </div>

            <div className="flex items-center justify-between p-4 border-2 border-black hover:bg-gray-50 transition-colors opacity-60">
              <div>
                <h4 className="text-lg font-black uppercase">2FA Authentication</h4>
                <p className="text-xs text-gray-500 font-mono">Enhance your security level.</p>
              </div>
              <div className="bg-gray-200 text-gray-500 px-3 py-1 text-xs font-black uppercase border-2 border-gray-400">Coming Soon</div>
            </div>

            <div className="flex items-center justify-between p-4 border-2 border-black hover:bg-gray-50 transition-colors opacity-60">
              <div>
                <h4 className="text-lg font-black uppercase">Notifications</h4>
                <p className="text-xs text-gray-500 font-mono">Manage email alerts.</p>
              </div>
              <div className="bg-gray-200 text-gray-500 px-3 py-1 text-xs font-black uppercase border-2 border-gray-400">Default</div>
            </div>
          </div>
        </div>

      </main>

      {/* Password Change Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowPasswordModal(false)}></div>

          <div className="relative w-full max-w-md bg-white border-4 border-black neo-shadow-lg p-8 animate-in fade-in zoom-in duration-200">
            <button
              onClick={() => setShowPasswordModal(false)}
              className="absolute top-4 right-4 text-gray-500 hover:text-black hover:rotate-90 transition-transform"
            >
              <X size={28} className="stroke-[3]" />
            </button>

            <div className="mb-8 text-center">
              <div className="inline-block p-3 bg-red-100 border-2 border-black rounded-full mb-4">
                <Lock size={32} className="text-red-500" />
              </div>
              <h3 className="text-2xl font-black uppercase">Change Password</h3>
            </div>

            <div className="space-y-4">
              <div>
                <label className={labelClass}>Current Password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className={inputClass}
                  required
                />
              </div>

              <div>
                <label className={labelClass}>New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className={inputClass}
                  required
                />
              </div>

              <div>
                <label className={labelClass}>Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={inputClass}
                  required
                />
              </div>

              {passwordError && (
                <div className="bg-red-100 border-2 border-red-500 text-red-700 p-3 text-sm font-bold flex items-center gap-2">
                  <AlertTriangle size={16} />
                  {passwordError}
                </div>
              )}
            </div>

            <div className="flex gap-4 mt-8">
              <button
                onClick={() => setShowPasswordModal(false)}
                className={`${btnSecondary} w-full`}
              >
                Cancel
              </button>
              <button
                onClick={handlePasswordChange}
                disabled={isLoading}
                className={`${btnPrimary} w-full bg-red-600 border-red-900 group`}
              >
                {isLoading ? "Updating..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}