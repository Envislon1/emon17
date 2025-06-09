
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, Info } from 'lucide-react';

const BudgetInfo = () => {
  return (
    <Card className="energy-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-orange-600" />
          Cost Information
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-center p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
          <Info className="w-8 h-8 text-orange-600 mx-auto mb-2" />
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
            Costs are calculated proportionally based on energy consumption.
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-500">
            Set the total monthly bill for each device to see individual channel costs.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default BudgetInfo;
