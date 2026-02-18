import React from 'react';
import { X, Rocket, CheckCircle, AlertCircle } from 'lucide-react';

export type DeploymentEnvironment = 'on-the-fly' | 'development' | 'staging' | 'production';
export type DeploymentType = 'full' | 'incremental' | 'verify-only';

export interface DeploymentConfig {
  environment: DeploymentEnvironment;
  type: DeploymentType;
  projectId: string;
  locale: string;
  verifyAfterDeploy: boolean;
}

interface DeploymentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string | null;
  locale: string;
  onDeploy: (config: DeploymentConfig) => Promise<void>;
}

export default function DeploymentDialog({
  isOpen,
  onClose,
  projectId,
  locale,
  onDeploy
}: DeploymentDialogProps) {
  const [environment, setEnvironment] = React.useState<DeploymentEnvironment>('development');
  const [type, setType] = React.useState<DeploymentType>('full');
  const [verifyAfterDeploy, setVerifyAfterDeploy] = React.useState(true);
  const [isDeploying, setIsDeploying] = React.useState(false);
  const [deployResult, setDeployResult] = React.useState<{ success: boolean; error?: string; result?: any } | null>(null);

  if (!isOpen) return null;

  const handleDeploy = async () => {
    if (!projectId) {
      alert('Project ID is required');
      return;
    }

    setIsDeploying(true);
    setDeployResult(null);

    try {
      await onDeploy({
        environment,
        type,
        projectId,
        locale,
        verifyAfterDeploy
      });
      setDeployResult({ success: true });
    } catch (error) {
      setDeployResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setIsDeploying(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Rocket size={24} />
            Deployment Configuration
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        <div className="space-y-6">
          {/* Environment Selection */}
          <div>
            <label className="block text-sm font-medium mb-2">Environment</label>
            <select
              value={environment}
              onChange={(e) => setEnvironment(e.target.value as DeploymentEnvironment)}
              className="w-full p-2 border rounded"
              disabled={isDeploying}
            >
              <option value="on-the-fly">On-the-Fly (Test Mode)</option>
              <option value="development">Development</option>
              <option value="staging">Staging</option>
              <option value="production">Production</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              {environment === 'on-the-fly' && 'Automatic deployment for testing. Redis is synced immediately.'}
              {environment === 'development' && 'Development environment. Safe for testing.'}
              {environment === 'staging' && 'Staging environment. Pre-production testing.'}
              {environment === 'production' && 'Production environment. Live system.'}
            </p>
          </div>

          {/* Deployment Type */}
          <div>
            <label className="block text-sm font-medium mb-2">Deployment Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as DeploymentType)}
              className="w-full p-2 border rounded"
              disabled={isDeploying}
            >
              <option value="full">Full Sync (All translations)</option>
              <option value="incremental">Incremental (Only changed)</option>
              <option value="verify-only">Verify Only (No changes)</option>
            </select>
          </div>

          {/* Verify After Deploy */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="verifyAfterDeploy"
              checked={verifyAfterDeploy}
              onChange={(e) => setVerifyAfterDeploy(e.target.checked)}
              disabled={isDeploying}
            />
            <label htmlFor="verifyAfterDeploy" className="text-sm">
              Verify Redis consistency after deployment
            </label>
          </div>

          {/* Deploy Result */}
          {deployResult && (
            <div className={`p-4 rounded flex items-center gap-2 ${
              deployResult.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
            }`}>
              {deployResult.success ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
              <div>
                {deployResult.success ? (
                  <p>✅ Deployment completed successfully</p>
                ) : (
                  <p>❌ Deployment failed: {deployResult.error}</p>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border rounded hover:bg-gray-50"
              disabled={isDeploying}
            >
              Cancel
            </button>
            <button
              onClick={handleDeploy}
              disabled={isDeploying || !projectId}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {isDeploying ? 'Deploying...' : 'Deploy'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
