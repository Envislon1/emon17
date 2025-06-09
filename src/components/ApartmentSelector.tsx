
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useEnergy } from '@/contexts/EnergyContext';
import { RefreshCw, Info } from 'lucide-react';

const SystemInfo = () => {
  const { refreshData, isLoading } = useEnergy();

  return (
    <Card className="energy-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Info className="w-5 h-5 text-orange-600" />
          System Information
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
            Add devices using their Device ID to monitor energy consumption.
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-500">
            Each device can have multiple channels (House1, House2, etc.) that you can rename.
          </p>
        </div>
        
        <Button 
          onClick={refreshData}
          disabled={isLoading}
          variant="outline"
          className="w-full"
        >
          {isLoading ? (
            <>
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              Refreshing...
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh Data
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};

export default SystemInfo;
