import { useState } from 'react';
import { Clock, LogOut, Loader2 } from 'lucide-react';
import { signOut } from '../../services/authService';
import { useAuth } from '../../contexts/AuthContext';

export default function AccessPendingPage() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const handleSignOut = async () => {
    setIsLoading(true);
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 mb-4 shadow-lg shadow-amber-500/20">
            <Clock className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Access Pending</h1>
          <p className="text-gray-500 mt-1">Your account is ready</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl shadow-gray-200/50 p-8">
          <div className="text-center mb-6">
            <p className="text-sm text-gray-600 mb-2">Signed in as</p>
            <p className="font-medium text-gray-900">{user?.email}</p>
          </div>

          <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 mb-6">
            <p className="text-sm text-amber-800 text-center">
              You have not been added to any workspace yet. Please contact your workspace administrator to request access.
            </p>
          </div>

          <p className="text-sm text-gray-500 text-center mb-6">
            Once you are added to a workspace, you will be able to access Lab Manager.
          </p>

          <button
            onClick={handleSignOut}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-200 text-gray-600 font-medium rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <LogOut className="h-5 w-5" />
                Sign out
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
