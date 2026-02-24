/**
 * Analyses List Page
 *
 * Lists all past AI crew executions for the tenant
 */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatDistance } from 'date-fns';

interface Execution {
  id: string;
  crewTemplateId: string;
  entityType: string | null;
  entityId: string | null;
  status: string;
  startedAt: Date | null;
  completedAt: Date | null;
  creditsConsumed: number | null;
  executionTimeSeconds: number | null;
  modelName: string | null;
  errorMessage: string | null;
  createdAt: Date;
}

export default function AnalysesPage() {
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'completed' | 'failed' | 'pending' | 'running'>('all');

  // TODO: Get actual tenantId from context/session
  const tenantId = 'demo-tenant-id';

  useEffect(() => {
    fetchExecutions();
  }, [filter]);

  const fetchExecutions = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/analyses?tenantId=${tenantId}&status=${filter}&limit=50`
      );
      const data = await response.json();
      setExecutions(data.executions || []);
    } catch (error) {
      console.error('Failed to fetch analyses:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      completed: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
      running: 'bg-blue-100 text-blue-800',
      pending: 'bg-yellow-100 text-yellow-800',
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const formatCrewName = (slug: string) => {
    return slug
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">AI Analyses</h1>
        <p className="text-gray-600">View past AI crew executions and results</p>
      </div>

      {/* Filters */}
      <div className="mb-6 flex gap-2">
        {(['all', 'completed', 'failed', 'pending', 'running'] as const).map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === status
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        ))}
      </div>

      {/* Executions List */}
      {loading ? (
        <div className="text-center py-12">
          <p className="text-gray-500">Loading analyses...</p>
        </div>
      ) : executions.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-500 mb-2">No analyses found</p>
          <p className="text-sm text-gray-400">
            Run your first analysis to see results here
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {executions.map((execution) => (
            <Link
              key={execution.id}
              href={`/analyses/${execution.id}`}
              className="block bg-white border border-gray-200 rounded-lg p-6 hover:border-blue-500 hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold">
                      {formatCrewName(execution.crewTemplateId)}
                    </h3>
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusBadge(
                        execution.status
                      )}`}
                    >
                      {execution.status}
                    </span>
                  </div>

                  {execution.entityType && execution.entityId && (
                    <p className="text-sm text-gray-600 mb-2">
                      {execution.entityType}: {execution.entityId}
                    </p>
                  )}

                  {execution.errorMessage && (
                    <p className="text-sm text-red-600 mb-2">{execution.errorMessage}</p>
                  )}

                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span>
                      {formatDistance(new Date(execution.createdAt), new Date(), {
                        addSuffix: true,
                      })}
                    </span>
                    {execution.creditsConsumed !== null && (
                      <span>{execution.creditsConsumed} credits</span>
                    )}
                    {execution.executionTimeSeconds !== null && (
                      <span>{execution.executionTimeSeconds}s</span>
                    )}
                    {execution.modelName && <span>{execution.modelName}</span>}
                  </div>
                </div>

                <div className="ml-4">
                  <svg
                    className="w-5 h-5 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
