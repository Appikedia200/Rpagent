'use client';

/**
 * Accounts Panel Page
 *
 * Displays all created accounts with:
 * - Real-time updates
 * - Copy to clipboard
 * - Export to CSV
 * - Search functionality
 * - Delete accounts
 */

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import {
  Copy,
  Download,
  Search,
  Trash2,
  MoreVertical,
  RefreshCw,
  Mail,
  Key,
  User,
  Calendar,
  MapPin,
} from 'lucide-react';
import { useAccounts } from '@/hooks/use-accounts';
import { isElectron } from '@/lib/ipc-client';

export default function AccountsPage() {
  const { accounts, stats, loading, loadAccounts, searchAccounts, deleteAccount, exportToCSV } = useAccounts();
  const [searchQuery, setSearchQuery] = React.useState('');

  // Handle search
  const handleSearch = () => {
    if (searchQuery.trim()) {
      searchAccounts(searchQuery);
    } else {
      loadAccounts();
    }
  };

  // Copy to clipboard
  const copyToClipboard = async (text: string, _type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // Could show a toast here
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  // Export to CSV
  const handleExport = async () => {
    const csvContent = await exportToCSV();
    if (csvContent) {
      // Create download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `accounts_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
    }
  };

  // Handle delete
  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this account?')) {
      return;
    }
    await deleteAccount(id);
  };

  // Get service badge color
  const getServiceColor = (service: string): string => {
    const colors: Record<string, string> = {
      gmail: 'bg-red-500',
      google: 'bg-blue-500',
      youtube: 'bg-red-600',
      instagram: 'bg-pink-500',
      twitter: 'bg-sky-500',
      facebook: 'bg-blue-600',
      tiktok: 'bg-slate-900',
    };
    return colors[service.toLowerCase()] || 'bg-slate-500';
  };

  // Filter accounts by search
  const filteredAccounts = searchQuery
    ? accounts.filter(
        (acc) =>
          acc.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
          acc.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          acc.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          acc.username?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : accounts;

  // Show message if not in Electron
  if (!isElectron()) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Accounts Panel</CardTitle>
            <CardDescription>
              This feature is only available in the desktop application.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Created Accounts</h1>
          <p className="text-muted-foreground mt-1">
            {stats.totalCount} accounts created automatically
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadAccounts} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={handleExport} disabled={accounts.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Accounts</CardDescription>
            <CardTitle className="text-3xl">{stats.totalCount}</CardTitle>
          </CardHeader>
        </Card>
        {Object.entries(stats.byService).map(([service, count]) => (
          <Card key={service}>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Badge className={`${getServiceColor(service)} text-white`}>{service}</Badge>
              </CardDescription>
              <CardTitle className="text-2xl">{count}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      {/* Search Bar */}
      <div className="flex gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by email, name, or username..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="pl-9"
          />
        </div>
        <Button onClick={handleSearch}>Search</Button>
        {searchQuery && (
          <Button
            variant="outline"
            onClick={() => {
              setSearchQuery('');
              loadAccounts();
            }}
          >
            Clear
          </Button>
        )}
      </div>

      {/* Accounts Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredAccounts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg">No accounts found</p>
              <p className="text-sm">
                Created accounts will appear here automatically
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Service</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Password</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAccounts.map((account) => (
                  <TableRow key={account.id}>
                    <TableCell>
                      <Badge className={`${getServiceColor(account.service)} text-white`}>
                        {account.service}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <code className="text-sm bg-muted px-2 py-1 rounded">
                          {account.email}
                        </code>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6"
                          onClick={() => copyToClipboard(account.email, 'Email')}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <code className="text-sm bg-muted px-2 py-1 rounded font-mono">
                          {account.password}
                        </code>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6"
                          onClick={() => copyToClipboard(account.password, 'Password')}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3 text-muted-foreground" />
                        <span>
                          {account.firstName} {account.lastName}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs text-muted-foreground space-y-0.5">
                        {account.phone && (
                          <div className="flex items-center gap-1">
                            <Key className="h-3 w-3" />
                            {account.phone}
                          </div>
                        )}
                        {account.birthDate && (
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {account.birthDate}
                          </div>
                        )}
                        {account.address && (
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {account.address.slice(0, 30)}...
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(account.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() =>
                              copyToClipboard(
                                `${account.email}\n${account.password}`,
                                'Credentials'
                              )
                            }
                          >
                            <Copy className="h-4 w-4 mr-2" />
                            Copy Credentials
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => handleDelete(account.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
