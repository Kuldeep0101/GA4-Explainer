import { useState, useEffect } from 'react';

export type ReportStatus = 'pending' | 'simplifying' | 'analyzing' | 'completed' | 'failed' | null;

interface UseReportStatusReturn {
  status: ReportStatus;
  progress: number;
  data: any | null;
  error: string | null;
}

export function useReportStatus(reportId: string | null): UseReportStatusReturn {
  const [status, setStatus] = useState<ReportStatus>(null);
  const [progress, setProgress] = useState(0);
  const [data, setData] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!reportId) {
      // Reset state if reportId is cleared
      setStatus(null);
      setProgress(0);
      setData(null);
      setError(null);
      return;
    }

    let intervalId: NodeJS.Timeout;
    let isCompleted = false;

    const poll = async () => {
      if (isCompleted) return; // Hard-stop any rogue interval triggers

      try {
        const res = await fetch(`/api/report-status?id=${reportId}`);
        if (!res.ok) return;
        
        const json = await res.json();
        const currentStatus = json.status as ReportStatus;
        
        setStatus(currentStatus);

        if (currentStatus === 'pending') {
          setProgress(10);
        } else if (currentStatus === 'simplifying') {
          setProgress(30);
        } else if (currentStatus === 'analyzing') {
          setProgress(65);
        } else if (currentStatus === 'completed') {
          isCompleted = true; // Flag immediately
          setProgress(100);
          setData(json.data);
          if (intervalId) clearInterval(intervalId);
        } else if (currentStatus === 'failed') {
          isCompleted = true; // Flag immediately
          setError(json.error_message || 'Report Generation Failed');
          if (intervalId) clearInterval(intervalId);
        }
      } catch (err: any) {
        console.error('Polling error:', err);
      }
    };

    // run initially
    poll();
    // poll every 3 seconds
    intervalId = setInterval(poll, 3000);

    return () => clearInterval(intervalId);
  }, [reportId]);

  return { status, progress, data, error };
}
