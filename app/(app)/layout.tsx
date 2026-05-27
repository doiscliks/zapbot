import AuthGuard from '@/components/AuthGuard'
import Sidebar from '@/components/Sidebar'
import TopBar from '@/components/TopBar'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className="flex h-full min-h-screen">
        <Sidebar />
        <TopBar />
        <main className="flex-1 overflow-auto pt-14 md:pt-[52px]" style={{ backgroundColor: '#F8FAFC' }}>{children}</main>
      </div>
    </AuthGuard>
  )
}
