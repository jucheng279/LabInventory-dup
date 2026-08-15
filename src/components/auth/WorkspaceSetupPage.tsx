import { useState } from 'react';
import { Building2, Loader2, LogOut } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { signOut } from '../../services/authService';

export default function WorkspaceSetupPage() {
  const { user, createWorkspace } = useAuth();
  const [workspaceName, setWorkspaceName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const name = workspaceName.trim();
    if (!name) {
      setError('Please enter a workspace name');
      return;
    }

    setIsCreating(true);
    setError('');

    const success = await createWorkspace(name);

    if (!success) {
      setError('Failed to create workspace. Please try again.');
      setIsCreating(false);
    }
  };

  const handleSignOut = async () => {
    setIsLoggingOut(true);
    try {
      await signOut();
    } catch (err) {
      console.error('Error signing out:', err);
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 mb-4 shadow-lg shadow-blue-500/20">
            <Building2 className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Create Your Workspace</h1>
          <p className="text-gray-500 mt-1">Set up your workspace to get started</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl shadow-gray-200/50 p-8">
          <div className="text-center mb-6">
            <p className="text-sm text-gray-600 mb-2">Signed in as</p>
            <p className="font-medium text-gray-900">{user?.email}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="workspaceName" className="block text-sm font-medium text-gray-700 mb-2">
                Workspace Name
              </label>
              <input
                id="workspaceName"
                type="text"
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                placeholder="e.g., Walker Lab"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                disabled={isCreating}
                autoFocus
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-100 rounded-xl p-3">
                <p className="text-sm text-red-600 text-center">{error}</p>
              </div>
            )}

            <p className="text-sm text-gray-500 text-center">
              You can invite team members after creating your workspace.
            </p>

            <button
              type="submit"
              disabled={isCreating || !workspaceName.trim()}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-medium rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all duration-200 shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCreating ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Creating workspace...
                </>
              ) : (
                <>
                  <Building2 className="h-5 w-5" />
                  Create Workspace
                </>
              )}
            </button>
          </form>

          <div className="mt-4 pt-4 border-t border-gray-100">
            <button
              onClick={handleSignOut}
              disabled={isLoggingOut}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-200 text-gray-600 font-medium rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              {isLoggingOut ? (
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
    </div>
  );
}
