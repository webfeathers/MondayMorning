/**
 * Analysis Detail Page
 *
 * Shows detailed results of a specific AI crew execution
 */

'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';

interface ExecutionDetail {
  id: string;
  crewTemplateId: string;
  entityType: string | null;
  entityId: string | null;
  status: string;
  startedAt: Date | null;
  completedAt: Date | null;
  result: any;
  rawOutput: string | null;
  tokenUsage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  } | null;
  creditsConsumed: number | null;
  executionTimeSeconds: number | null;
  modelName: string | null;
  errorMessage: string | null;
  errorDetails: any;
  metadata: any;
  createdAt: Date;
}

export default function AnalysisDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [execution, setExecution] = useState<ExecutionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'result' | 'raw' | 'details'>('result');

  useEffect(() => {
    fetchExecution();
  }, [id]);

  const fetchExecution = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/analyses/${id}`);
      const data = await response.json();
      setExecution(data);
    } catch (error) {
      console.error('Failed to fetch execution:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCrewName = (slug: string) => {
    return slug
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const getStatusColor = (status: string) => {
    const colors = {
      completed: 'text-green-600 bg-green-100',
      failed: 'text-red-600 bg-red-100',
      running: 'text-blue-600 bg-blue-100',
      pending: 'text-yellow-600 bg-yellow-100',
    };
    return colors[status as keyof typeof colors] || 'text-gray-600 bg-gray-100';
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <p className="text-center text-gray-500">Loading analysis...</p>
      </div>
    );
  }

  if (!execution) {
    return (
      <div className="container mx-auto py-8 px-4">
        <p className="text-center text-red-600">Analysis not found</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/analyses"
          className="text-blue-600 hover:text-blue-700 text-sm font-medium mb-4 inline-block"
        >
          ← Back to Analyses
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">
              {formatCrewName(execution.crewTemplateId)}
            </h1>
            {execution.entityType && execution.entityId && (
              <p className="text-gray-600">
                {execution.entityType}: {execution.entityId}
              </p>
            )}
          </div>
          <span
            className={`px-4 py-2 rounded-full font-semibold ${getStatusColor(
              execution.status
            )}`}
          >
            {execution.status.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Metadata */}
      <div className="bg-gray-50 rounded-lg p-6 mb-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <p className="text-sm text-gray-500 mb-1">Created</p>
          <p className="font-medium">
            {format(new Date(execution.createdAt), 'MMM d, yyyy HH:mm')}
          </p>
        </div>
        {execution.executionTimeSeconds && (
          <div>
            <p className="text-sm text-gray-500 mb-1">Duration</p>
            <p className="font-medium">{execution.executionTimeSeconds}s</p>
          </div>
        )}
        {execution.creditsConsumed !== null && (
          <div>
            <p className="text-sm text-gray-500 mb-1">Credits Used</p>
            <p className="font-medium">{execution.creditsConsumed}</p>
          </div>
        )}
        {execution.tokenUsage && (
          <div>
            <p className="text-sm text-gray-500 mb-1">Tokens</p>
            <p className="font-medium">{execution.tokenUsage.total_tokens.toLocaleString()}</p>
          </div>
        )}
      </div>

      {/* Error Message */}
      {execution.errorMessage && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-800 font-medium mb-1">Error</p>
          <p className="text-red-700">{execution.errorMessage}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <div className="flex gap-4">
          {['result', 'raw', 'details'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as typeof activeTab)}
              className={`pb-3 px-1 font-medium transition-colors ${
                activeTab === tab
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div>
        {activeTab === 'result' && (
          <div>
            {execution.result ? (
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <pre className="whitespace-pre-wrap text-sm">
                  {JSON.stringify(execution.result, null, 2)}
                </pre>
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">No structured result available</p>
            )}
          </div>
        )}

        {activeTab === 'raw' && (
          <div>
            {execution.rawOutput ? (
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <pre className="whitespace-pre-wrap text-sm">{execution.rawOutput}</pre>
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">No raw output available</p>
            )}
          </div>
        )}

        {activeTab === 'details' && (
          <div className="space-y-6">
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="font-semibold mb-4">Execution Details</h3>
              <dl className="space-y-3">
                <div>
                  <dt className="text-sm text-gray-500">Execution ID</dt>
                  <dd className="font-mono text-sm">{execution.id}</dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">Model</dt>
                  <dd>{execution.modelName || 'N/A'}</dd>
                </div>
                {execution.tokenUsage && (
                  <>
                    <div>
                      <dt className="text-sm text-gray-500">Prompt Tokens</dt>
                      <dd>{execution.tokenUsage.prompt_tokens.toLocaleString()}</dd>
                    </div>
                    <div>
                      <dt className="text-sm text-gray-500">Completion Tokens</dt>
                      <dd>{execution.tokenUsage.completion_tokens.toLocaleString()}</dd>
                    </div>
                  </>
                )}
              </dl>
            </div>

            {execution.metadata && (
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="font-semibold mb-4">Metadata</h3>
                <pre className="text-sm whitespace-pre-wrap">
                  {JSON.stringify(execution.metadata, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
