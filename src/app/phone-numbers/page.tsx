'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { 
  Phone, 
  Plus, 
  Trash2, 
  Upload, 
  RefreshCw,
  MessageSquare,
  CheckCircle,
  XCircle,
  Clock,
  Settings,
} from 'lucide-react';

interface PhoneNumber {
  id: string;
  number: string;
  provider: 'telnyx' | 'twilio' | 'manual';
  status: 'available' | 'in_use' | 'blocked' | 'expired';
  country: string;
  lastUsed?: string;
  assignedTo?: string;
  createdAt: string;
}

interface ReceivedSMS {
  id: string;
  to: string;
  from: string;
  body: string;
  code?: string;
  receivedAt: string;
  processed: boolean;
}

interface PhoneStats {
  total: number;
  available: number;
  inUse: number;
  blocked: number;
}

export default function PhoneNumbersPage() {
  const [numbers, setNumbers] = useState<PhoneNumber[]>([]);
  const [stats, setStats] = useState<PhoneStats>({ total: 0, available: 0, inUse: 0, blocked: 0 });
  const [smsHistory, setSmsHistory] = useState<ReceivedSMS[]>([]);
  const [selectedNumber, setSelectedNumber] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [telnyxDialogOpen, setTelnyxDialogOpen] = useState(false);
  const [newNumber, setNewNumber] = useState('');
  const [importText, setImportText] = useState('');
  const [telnyxApiKey, setTelnyxApiKey] = useState('');
  const [telnyxVerified, setTelnyxVerified] = useState<boolean | null>(null);
  const [verifying, setVerifying] = useState(false);

  // Load numbers on mount
  useEffect(() => {
    loadNumbers();
    loadStats();
    
    // Listen for events
    const handleNumberAdded = (_event: unknown, ...args: unknown[]) => {
      const number = args[0] as PhoneNumber;
      if (number) {
        setNumbers(prev => [...prev, number]);
        loadStats();
      }
    };
    
    const handleNumberRemoved = (_event: unknown, ...args: unknown[]) => {
      const number = args[0] as PhoneNumber;
      if (number) {
        setNumbers(prev => prev.filter(n => n.id !== number.id));
        loadStats();
      }
    };
    
    const handleSmsReceived = (_event: unknown, ...args: unknown[]) => {
      const sms = args[0] as ReceivedSMS;
      if (sms) {
        setSmsHistory(prev => [sms, ...prev].slice(0, 50));
      }
    };

    window.electron?.on?.('event:phoneNumberAdded', handleNumberAdded);
    window.electron?.on?.('event:phoneNumberRemoved', handleNumberRemoved);
    window.electron?.on?.('event:phoneSMSReceived', handleSmsReceived);
    
    return () => {
      window.electron?.removeAllListeners?.('event:phoneNumberAdded');
      window.electron?.removeAllListeners?.('event:phoneNumberRemoved');
      window.electron?.removeAllListeners?.('event:phoneSMSReceived');
    };
  }, []);

  const loadNumbers = async () => {
    try {
      const result = await window.electron.invoke<{ success: boolean; numbers: PhoneNumber[] }>('phone:getAll');
      if (result.success) {
        setNumbers(result.numbers || []);
      }
    } catch (error) {
      console.error('Failed to load numbers:', error);
    }
  };

  const loadStats = async () => {
    try {
      const result = await window.electron.invoke<{ success: boolean; stats: PhoneStats }>('phone:getStats');
      if (result.success) {
        setStats(result.stats);
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const loadSmsHistory = useCallback(async (phoneNumber: string) => {
    try {
      const result = await window.electron.invoke<{ success: boolean; history: ReceivedSMS[] }>(
        'phone:getSMSHistory',
        phoneNumber
      );
      if (result.success) {
        setSmsHistory(result.history || []);
      }
    } catch (error) {
      console.error('Failed to load SMS history:', error);
    }
  }, []);

  const handleAddNumber = async () => {
    if (!newNumber.trim()) return;
    
    setLoading(true);
    try {
      await window.electron.invoke('phone:addNumber', { number: newNumber.trim(), provider: 'manual' });
      setNewNumber('');
      setAddDialogOpen(false);
      await loadNumbers();
      await loadStats();
    } catch (error) {
      console.error('Failed to add number:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleImportNumbers = async () => {
    if (!importText.trim()) return;
    
    const numberList = importText.split('\n').map(n => n.trim()).filter(Boolean);
    if (numberList.length === 0) return;
    
    setLoading(true);
    try {
      const result = await window.electron.invoke<{ success: boolean; count: number }>(
        'phone:importNumbers',
        { numbers: numberList, provider: 'manual' }
      );
      if (result.success) {
        setImportText('');
        setImportDialogOpen(false);
        await loadNumbers();
        await loadStats();
      }
    } catch (error) {
      console.error('Failed to import numbers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveNumber = async (id: string) => {
    try {
      await window.electron.invoke('phone:removeNumber', id);
      await loadNumbers();
      await loadStats();
    } catch (error) {
      console.error('Failed to remove number:', error);
    }
  };

  const handleVerifyTelnyx = async () => {
    if (!telnyxApiKey.trim()) return;
    
    setVerifying(true);
    setTelnyxVerified(null);
    
    try {
      const result = await window.electron.invoke<{ valid: boolean; error?: string }>(
        'phone:verifyTelnyx',
        { apiKey: telnyxApiKey }
      );
      setTelnyxVerified(result.valid);
    } catch (error) {
      console.error('Failed to verify Telnyx:', error);
      setTelnyxVerified(false);
    } finally {
      setVerifying(false);
    }
  };

  const handleFetchTelnyxNumbers = async () => {
    setLoading(true);
    try {
      const result = await window.electron.invoke<{ success: boolean; count: number }>('phone:fetchTelnyx');
      if (result.success) {
        await loadNumbers();
        await loadStats();
        setTelnyxDialogOpen(false);
      }
    } catch (error) {
      console.error('Failed to fetch Telnyx numbers:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'available':
        return <Badge className="bg-green-600"><CheckCircle className="w-3 h-3 mr-1" />Available</Badge>;
      case 'in_use':
        return <Badge className="bg-blue-600"><Clock className="w-3 h-3 mr-1" />In Use</Badge>;
      case 'blocked':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Blocked</Badge>;
      case 'expired':
        return <Badge variant="secondary">Expired</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Phone Numbers</h1>
          <p className="text-muted-foreground">
            Manage phone numbers for SMS verification
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={telnyxDialogOpen} onOpenChange={setTelnyxDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Settings className="w-4 h-4 mr-2" />
                Telnyx Setup
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Configure Telnyx</DialogTitle>
                <DialogDescription>
                  Connect your Telnyx account to manage phone numbers
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Telnyx API Key</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      type="password"
                      value={telnyxApiKey}
                      onChange={(e) => setTelnyxApiKey(e.target.value)}
                      placeholder="KEY..."
                    />
                    <Button 
                      onClick={handleVerifyTelnyx}
                      disabled={verifying || !telnyxApiKey}
                      variant={telnyxVerified ? 'default' : 'secondary'}
                    >
                      {verifying ? 'Verifying...' : telnyxVerified ? '✓ Verified' : 'Verify'}
                    </Button>
                  </div>
                  {telnyxVerified === false && (
                    <p className="text-red-500 text-sm mt-1">Invalid API key</p>
                  )}
                </div>
                {telnyxVerified && (
                  <Button onClick={handleFetchTelnyxNumbers} disabled={loading} className="w-full">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Fetch Numbers from Telnyx
                  </Button>
                )}
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Upload className="w-4 h-4 mr-2" />
                Import List
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Import Phone Numbers</DialogTitle>
                <DialogDescription>
                  Paste phone numbers, one per line
                </DialogDescription>
              </DialogHeader>
              <Textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder="+1234567890
+1987654321
+1555123456"
                rows={10}
              />
              <DialogFooter>
                <Button onClick={handleImportNumbers} disabled={loading}>
                  {loading ? 'Importing...' : 'Import Numbers'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add Number
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Phone Number</DialogTitle>
                <DialogDescription>
                  Add a single phone number
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Phone Number (E.164 format)</Label>
                  <Input
                    value={newNumber}
                    onChange={(e) => setNewNumber(e.target.value)}
                    placeholder="+1234567890"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleAddNumber} disabled={loading}>
                  {loading ? 'Adding...' : 'Add Number'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Numbers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Available</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{stats.available}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">In Use</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-500">{stats.inUse}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Blocked</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{stats.blocked}</div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-3 gap-6">
        {/* Numbers Table */}
        <Card className="col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="w-5 h-5" />
              Phone Numbers
            </CardTitle>
            <CardDescription>
              {numbers.length} numbers in database
            </CardDescription>
          </CardHeader>
          <CardContent>
            {numbers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No phone numbers yet. Add numbers manually or connect Telnyx.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Number</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Country</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {numbers.map((num) => (
                    <TableRow 
                      key={num.id}
                      className={selectedNumber === num.number ? 'bg-accent' : ''}
                      onClick={() => {
                        setSelectedNumber(num.number);
                        loadSmsHistory(num.number);
                      }}
                    >
                      <TableCell className="font-mono">{num.number}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{num.provider}</Badge>
                      </TableCell>
                      <TableCell>{getStatusBadge(num.status)}</TableCell>
                      <TableCell>{num.country}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveNumber(num.id);
                          }}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* SMS History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              SMS History
            </CardTitle>
            <CardDescription>
              {selectedNumber ? `Messages for ${selectedNumber}` : 'Select a number to view messages'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {smsHistory.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {selectedNumber ? 'No messages received yet' : 'Select a phone number'}
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {smsHistory.map((sms) => (
                  <div
                    key={sms.id}
                    className={`p-3 rounded-lg border ${sms.code ? 'border-green-500 bg-green-500/10' : 'border-border'}`}
                  >
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                      <span>From: {sms.from}</span>
                      <span>{new Date(sms.receivedAt).toLocaleTimeString()}</span>
                    </div>
                    <p className="text-sm">{sms.body}</p>
                    {sms.code && (
                      <div className="mt-2 flex items-center gap-2">
                        <Badge className="bg-green-600 text-lg font-mono">{sms.code}</Badge>
                        <span className="text-xs text-green-500">Verification Code Detected</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

