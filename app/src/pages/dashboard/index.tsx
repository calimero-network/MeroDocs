import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getAppEndpointKey,
  getApplicationId,
} from '@calimero-network/calimero-client';
import {
  FileText,
  Users,
  Search,
  Plus,
  MoreVertical,
  ArrowRight,
  Clock,
  Layers,
  X,
  UserPlus,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Button, Card, CardContent } from '../../components/ui';
import { MobileLayout } from '../../components/MobileLayout';
import { useTheme } from '../../contexts/ThemeContext';
import { AgreementService } from '../../api/agreementService';
import { ContextApiDataSource } from '../../api/dataSource/nodeApiDataSource';
import { ClientApiDataSource } from '../../api/dataSource/ClientApiDataSource';
import { Agreement } from '../../api/clientApi';

export default function Dashboard() {
  const navigate = useNavigate();
  const { mode } = useTheme();
  const url = getAppEndpointKey();
  const applicationId = getApplicationId();
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [agreementName, setAgreementName] = useState('');
  const [invitationPayload, setInvitationPayload] = useState('');
  const [contextName, setContextName] = useState('');
  const [selectedRole, setSelectedRole] = useState<'Signer' | 'Viewer'>(
    'Signer',
  );
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [joinProgress, setJoinProgress] = useState('');
  const [error, setError] = useState<string | null>(null);

  const agreementService = useMemo(() => new AgreementService(), []);
  const nodeApiService = useMemo(() => new ContextApiDataSource(), []);
  const clientApiService = useMemo(() => new ClientApiDataSource(), []);

  const loadAgreements = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await agreementService.listAgreements();

      if (response.error) {
        console.error('Dashboard: Error from listAgreements:', response.error);
        setError(response.error.message);
        setAgreements([]);
      } else {
        setAgreements(response.data || []);
      }
    } catch (err) {
      console.error('Failed to load agreements:', err);
      setError('Failed to load agreements');
      setAgreements([]);
    } finally {
      setLoading(false);
    }
  }, [agreementService]);

  useEffect(() => {
    if (url && applicationId) {
      loadAgreements();
    }
  }, [url, applicationId, loadAgreements]);

  const stats = [
    {
      label: 'Active Agreements',
      value: agreements.length,
      icon: Layers,
      color: 'text-blue-600',
      bg: 'bg-blue-100 dark:bg-blue-900/20',
    },
  ];

  const filteredContexts = agreements.filter((agreement) => {
    const matchesSearch = agreement.name
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  };

  const handleCreateAgreement = async () => {
    if (!agreementName.trim()) return;

    try {
      setCreating(true);
      setError(null);

      const response = await agreementService.createAgreement(
        agreementName.trim(),
      );

      if (response.error) {
        setError(response.error.message);
        return;
      }

      setShowCreateModal(false);
      setAgreementName('');

      await loadAgreements();
    } catch (err) {
      console.error('Failed to create agreement:', err);
      setError('Failed to create agreement');
    } finally {
      setCreating(false);
    }
  };

  const handleJoinAgreement = async () => {
    if (!invitationPayload.trim()) {
      setError('Please enter a valid invitation payload');
      return;
    }

    const payload = invitationPayload.trim();

    if (payload.length < 10) {
      setError('Invitation payload appears to be invalid (too short)');
      return;
    }

    try {
      setJoining(true);
      setError(null);
      setJoinProgress('Joining context...');

      const joinResponse = await nodeApiService.joinContext({
        invitationPayload: payload,
      });

      if (joinResponse.error) {
        console.error('Join context error:', joinResponse.error);
        setError(joinResponse.error.message || 'Failed to join context');
        return;
      }

      setJoinProgress('Storing context information...');
      const { contextId, memberPublicKey } = joinResponse.data;
      localStorage.setItem('agreementContextID', contextId);
      localStorage.setItem('agreementContextUserID', memberPublicKey);

      setJoinProgress('Joining shared context...');
      const joinSharedResponse = await clientApiService.joinSharedContext(
        contextId,
        memberPublicKey,
      );

      if (joinSharedResponse.error) {
        console.error('Join shared context error:', joinSharedResponse.error);
        setError(
          'Failed to join shared context: ' + joinSharedResponse.error.message,
        );
        return;
      }

      setJoinProgress('Finalizing...');
      setShowJoinModal(false);
      setInvitationPayload('');
      setContextName('');
      setSelectedRole('Signer');

      await loadAgreements();

      alert(
        `Successfully joined the agreement as ${selectedRole}! You can now access the shared documents.`,
      );
    } catch (err) {
      console.error('Failed to join agreement:', err);
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to join agreement';
      setError(errorMessage);
    } finally {
      setJoining(false);
      setJoinProgress('');
    }
  };

  const handleAgreementClick = (agreement: Agreement) => {
    localStorage.setItem('agreementContextID', agreement.contextId);
    localStorage.setItem('agreementContextUserID', agreement.sharedIdentity);

    navigate('/agreement');
  };

  return (
    <MobileLayout>
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-6"
      >
        {/* Header */}
        <motion.section variants={itemVariants} className="flex flex-col gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-1">
              Dashboard
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Manage your agreements and documents
            </p>
          </div>

          {/* Button and Stats Row */}
          <div className="flex flex-col sm:flex-row items-stretch gap-3 sm:gap-4">
            <div className="flex gap-2 flex-shrink-0">
              <Button
                onClick={() => setShowCreateModal(true)}
                className="group dark:text-black h-[52px] px-4 flex-1 sm:flex-none"
                size="sm"
              >
                <Plus className="w-4 h-4 mr-2" />
                New Agreement
              </Button>
              <Button
                onClick={() => setShowJoinModal(true)}
                variant="outline"
                className="group h-[52px] px-4 flex-1 sm:flex-none"
                size="sm"
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Join Agreement
              </Button>
            </div>

            <div className="flex-1">
              {stats.map((stat, index) => {
                const Icon = stat.icon;
                return (
                  <Card
                    key={index}
                    className="p-3 hover:shadow-lg transition-all duration-300 w-full h-[52px]"
                  >
                    <div className="flex items-center gap-3 h-full">
                      <div
                        className={`p-2 rounded-full ${stat.bg} flex-shrink-0`}
                      >
                        <Icon className={`w-4 h-4 ${stat.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-lg sm:text-xl font-bold text-foreground">
                          {stat.value}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {stat.label}
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        </motion.section>

        {/* Search */}
        <motion.section variants={itemVariants} className="px-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search agreements ..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 sm:py-3 text-sm sm:text-base border border-border rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-300"
            />
          </div>
        </motion.section>

        {/* Context Cards */}
        <motion.section variants={itemVariants}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <h2 className="text-xl sm:text-2xl font-bold text-foreground">
              Your Agreements
            </h2>
          </div>

          {loading && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="text-muted-foreground mt-2">
                Loading agreements...
              </p>
            </div>
          )}

          {error && !loading && (
            <div className="text-center py-8">
              <p className="text-red-500 mb-4">{error}</p>
              <Button onClick={loadAgreements} variant="outline">
                Try Again
              </Button>
            </div>
          )}

          {!loading && !error && filteredContexts.length === 0 && (
            <div className="text-center py-8">
              <FileText className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                No agreements found
              </h3>
              <p className="text-muted-foreground mb-4">
                Create your first agreement to get started with document
                management.
              </p>
              <Button onClick={() => setShowCreateModal(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create First Agreement
              </Button>
            </div>
          )}

          {!loading && !error && filteredContexts.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {filteredContexts.map((context) => (
                <motion.div
                  key={context.id}
                  whileHover={{ y: -2, scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                >
                  <Card
                    className="group cursor-pointer h-full hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 border-border/50 hover:border-primary/20"
                    onClick={() => handleAgreementClick(context)}
                  >
                    <CardContent className="p-4 sm:p-6">
                      {/* Header */}
                      <div className="flex items-start justify-between mb-3 sm:mb-4">
                        <div className="flex-1">
                          <h3 className="font-semibold text-sm sm:text-base text-foreground mb-1 group-hover:text-primary transition-colors duration-300 line-clamp-1">
                            {context.name}
                          </h3>
                          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed line-clamp-2">
                            Role: {context.role} • Context ID:{' '}
                            {context.contextId.slice(0, 8)}...
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="p-1 h-5 w-5 sm:h-6 sm:w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation();
                          }}
                        >
                          <MoreVertical className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                        </Button>
                      </div>

                      {/* Content */}
                      <div className="space-y-2.5 sm:space-y-3">
                        {/* Stats */}
                        <div className="flex items-center space-x-3 sm:space-x-4 text-xs sm:text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3 sm:w-4 sm:h-4" />
                            {context.role}
                          </span>
                          <span className="flex items-center gap-1">
                            <FileText className="w-3 h-3 sm:w-4 sm:h-4" />
                            Context
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 sm:w-4 sm:h-4" />
                            Active
                          </span>
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-between pt-2 border-t border-border/50">
                          <span className="text-xs text-muted-foreground">
                            Joined:{' '}
                            {new Date(
                              context.joinedAt / 1000000,
                            ).toLocaleDateString()}
                          </span>
                          <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all duration-300" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </motion.section>
      </motion.div>

      {/* Create Agreement Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className={`rounded-lg p-6 w-full max-w-md border border-border shadow-2xl ${
              mode === 'dark' ? 'bg-gray-900' : 'bg-white'
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">
                Create New Agreement
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowCreateModal(false);
                  setAgreementName('');
                  setError(null);
                }}
                className="p-1 h-auto w-auto"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            <div className="space-y-4">
              <div>
                <label
                  htmlFor="agreementName"
                  className="block text-sm font-medium text-foreground mb-2"
                >
                  Agreement Name
                </label>
                <input
                  id="agreementName"
                  type="text"
                  value={agreementName}
                  onChange={(e) => setAgreementName(e.target.value)}
                  placeholder="Enter agreement name..."
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  autoFocus
                />
              </div>

              {error && (
                <div className="p-3 bg-red-100 border border-red-300 rounded-lg">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <Button
                  onClick={() => {
                    setShowCreateModal(false);
                    setAgreementName('');
                    setError(null);
                  }}
                  variant="outline"
                  className="flex-1"
                  disabled={creating}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateAgreement}
                  className="flex-1 dark:text-black"
                  disabled={!agreementName.trim() || creating}
                >
                  {creating ? 'Creating...' : 'Create'}
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Join Agreement Modal */}
      {showJoinModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className={`rounded-lg p-6 w-full max-w-md border border-border shadow-2xl ${
              mode === 'dark' ? 'bg-gray-900' : 'bg-white'
            }`}
          >
            <div className="flex flex-col gap-4">
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Join Agreement
              </h3>
              <div>
                <label
                  htmlFor="invitationPayload"
                  className="block text-sm font-medium text-foreground mb-2"
                >
                  Invitation Payload
                </label>
                <textarea
                  id="invitationPayload"
                  value={invitationPayload}
                  onChange={(e) => setInvitationPayload(e.target.value)}
                  placeholder="Paste the invitation payload you received..."
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                  rows={4}
                  disabled={joining}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Enter the invitation payload shared by the agreement owner
                </p>
              </div>
              {error && (
                <div className="p-3 bg-red-100 border border-red-300 rounded-lg">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}
              <div className="flex gap-3 pt-4">
                <Button
                  onClick={() => {
                    setShowJoinModal(false);
                    setInvitationPayload('');
                    setError(null);
                    setJoinProgress('');
                  }}
                  variant="outline"
                  className="flex-1"
                  disabled={joining}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleJoinAgreement}
                  className="flex-1 dark:text-black"
                  disabled={!invitationPayload.trim() || joining}
                >
                  {joining ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                      {joinProgress || 'Joining...'}
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4 mr-2" />
                      Join Agreement
                    </>
                  )}
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </MobileLayout>
  );
}
