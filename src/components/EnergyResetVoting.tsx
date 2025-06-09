
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useEnergy } from '@/contexts/EnergyContext';
import { useAuth } from '@/contexts/AuthContext';
import { RotateCcw, Users, CheckCircle, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

const EnergyResetVoting = () => {
  const { deviceAssignments, voteForEnergyReset, getEnergyResetStatus } = useEnergy();
  const { user } = useAuth();
  const [selectedDevice, setSelectedDevice] = useState<string>('');
  const [isVoting, setIsVoting] = useState(false);
  const [resetStatus, setResetStatus] = useState<any>(null);
  const [hasVoted, setHasVoted] = useState(false);

  const handleVote = async () => {
    if (!selectedDevice) {
      toast.error('Please select a device first');
      return;
    }

    setIsVoting(true);
    try {
      const result = await voteForEnergyReset(selectedDevice);
      
      if (result.error) {
        toast.error(result.error);
        if (result.error.includes('already voted')) {
          setHasVoted(true);
        }
      } else {
        toast.success('Vote submitted successfully!');
        setHasVoted(true);
        if (result.reset_triggered) {
          toast.success('🎉 Energy reset has been triggered! Hardware will reset energy counters.');
        }
        loadResetStatus();
      }
    } catch (error) {
      toast.error('Failed to submit vote');
    } finally {
      setIsVoting(false);
    }
  };

  const loadResetStatus = async () => {
    if (!selectedDevice) return;
    
    try {
      const status = await getEnergyResetStatus(selectedDevice);
      console.log('Reset status loaded:', status);
      setResetStatus(status);
      
      // Check if current user has already voted
      if (status?.votes && user) {
        const userHasVoted = status.votes.some((vote: any) => vote.user_id === user.id);
        setHasVoted(userHasVoted);
      }
    } catch (error) {
      console.error('Failed to load reset status:', error);
    }
  };

  useEffect(() => {
    if (selectedDevice) {
      setHasVoted(false); // Reset vote status when device changes
      loadResetStatus();
      const interval = setInterval(loadResetStatus, 10000); // Check every 10 seconds
      return () => clearInterval(interval);
    }
  }, [selectedDevice]);

  useEffect(() => {
    if (deviceAssignments.length > 0 && !selectedDevice) {
      setSelectedDevice(deviceAssignments[0].device_id);
    }
  }, [deviceAssignments]);

  return (
    <Card className="energy-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RotateCcw className="w-5 h-5 text-energy-600 dark:text-energy-400" />
          Energy Reset Voting
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {deviceAssignments.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No devices available for reset</p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <label className="text-sm font-medium">Select Device:</label>
              <select 
                value={selectedDevice}
                onChange={(e) => setSelectedDevice(e.target.value)}
                className="w-full p-2 border border-border rounded-md bg-background"
              >
                {deviceAssignments.map((device) => (
                  <option key={device.device_id} value={device.device_id}>
                    {device.custom_name || device.device_name} ({device.channel_count} channels)
                  </option>
                ))}
              </select>
            </div>

            {resetStatus && (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    <span className="text-sm font-medium">Voting Progress</span>
                  </div>
                  <span className="text-sm font-bold">
                    {resetStatus.votes_received || 0}/{resetStatus.required_votes || 0}
                  </span>
                </div>

                {resetStatus.votes && resetStatus.votes.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Users who voted:</p>
                    <div className="space-y-1">
                      {resetStatus.votes.map((vote: any, index: number) => {
                        console.log('Vote data:', vote);
                        // Extract first name from full_name, fallback to truncated user ID
                        const fullName = vote.profiles?.full_name;
                        const displayName = fullName 
                          ? fullName.split(' ')[0] 
                          : `User ${vote.user_id.slice(0, 8)}...`;
                        
                        return (
                          <div key={index} className="flex items-center gap-2 text-sm">
                            <CheckCircle className="w-3 h-3 text-green-500" />
                            <span>{displayName}</span>
                            <span className="text-muted-foreground text-xs">
                              {new Date(vote.voted_at).toLocaleString()}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            <Button 
              onClick={handleVote}
              disabled={isVoting || hasVoted}
              className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isVoting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Submitting Vote...
                </>
              ) : hasVoted ? (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Vote Submitted
                </>
              ) : (
                <>
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Vote to Reset Energy Counters
                </>
              )}
            </Button>

            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5" />
                <div className="text-sm text-yellow-800 dark:text-yellow-200">
                  <p className="font-medium">How voting works:</p>
                  <ul className="mt-1 space-y-1 text-xs">
                    <li>• All tenants (channel users) must vote to reset</li>
                    <li>• Once all votes are collected, hardware will reset energy counters</li>
                    <li>• Each user can only vote once per reset session</li>
                    <li>• Voting sessions expire after 24 hours</li>
                  </ul>
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default EnergyResetVoting;
