'use client';
import { useState, useEffect } from 'react';
import { useFirestore, useUser } from '@/firebase';
import { collection, addDoc, getDocs, deleteDoc, doc, query, where, serverTimestamp } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Loader2, UserPlus, Trash2, Users, Mail, Clock, CheckCircle } from 'lucide-react';

interface Invitation {
  id: string;
  email: string;
  status: 'pending' | 'accepted';
  createdAt: any;
  businessName: string;
  businessId: string;
}

interface Superintendent {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  businessId: string;
}

export default function SuperintendentManager({ businessData }: { businessData: any }) {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [superintendents, setSuperintendents] = useState<Superintendent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [email, setEmail] = useState('');
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<any>(null);
  const [deleteType, setDeleteType] = useState<'invitation' | 'superintendent'>('invitation');

  const fetchData = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      // Cargar invitaciones
      const invitationsSnap = await getDocs(
        query(collection(firestore, 'invitations'), where('businessId', '==', user.uid))
      );
      setInvitations(invitationsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Invitation)));

      // Cargar superintendentes vinculados
      const superintendentsSnap = await getDocs(
        query(collection(firestore, 'users'), where('businessId', '==', user.uid), where('userType', '==', 'superintendent'))
      );
      setSuperintendents(superintendentsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Superintendent)));
    } catch (e) {
      console.error('Error cargando datos:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const handleSendInvitation = async () => {
    if (!email || !user) return;
    if (!email.includes('@')) {
      toast({ variant: 'destructive', title: 'Error', description: 'Ingresa un correo válido.' });
      return;
    }

    // Verificar si ya existe una invitación para ese email
    const existing = invitations.find(i => i.email.toLowerCase() === email.toLowerCase());
    if (existing) {
      toast({ variant: 'destructive', title: 'Error', description: 'Ya existe una invitación para ese correo.' });
      return;
    }

    setIsSending(true);
    try {
      const invitationData = {
        email: email.toLowerCase().trim(),
        businessId: user.uid,
        businessName: businessData?.companyName || 'Empresa',
        status: 'pending',
        createdAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(firestore, 'invitations'), invitationData);
      setInvitations(prev => [...prev, { id: docRef.id, ...invitationData, createdAt: new Date() } as Invitation]);
      setEmail('');
      toast({ title: '¡Invitación enviada!', description: `Se registró la invitación para ${email}.` });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message || 'No se pudo enviar la invitación.' });
    } finally {
      setIsSending(false);
    }
  };

  const confirmDelete = (item: any, type: 'invitation' | 'superintendent') => {
    setItemToDelete(item);
    setDeleteType(type);
    setIsDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;
    setIsDeleting(true);
    try {
      if (deleteType === 'invitation') {
        await deleteDoc(doc(firestore, 'invitations', itemToDelete.id));
        setInvitations(prev => prev.filter(i => i.id !== itemToDelete.id));
        toast({ title: 'Invitación eliminada.' });
      } else {
        // Borrar de Auth y Firestore usando la API de admin
        const res = await fetch('/api/delete-user', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: itemToDelete.id }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error al eliminar');
        setSuperintendents(prev => prev.filter(s => s.id !== itemToDelete.id));
        toast({ title: 'Superintendente eliminado correctamente.' });
      }
      setIsDeleteModalOpen(false);
      setItemToDelete(null);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Gestión de Superintendentes
          </CardTitle>
          <CardDescription>
            Agrega los correos de tus superintendentes. Cuando se registren, quedarán vinculados a tu empresa.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">

          {/* Formulario para agregar */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="correo@superintendente.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="pl-9"
                onKeyDown={e => e.key === 'Enter' && handleSendInvitation()}
                disabled={isSending}
              />
            </div>
            <Button onClick={handleSendInvitation} disabled={isSending || !email}>
              {isSending ? <Loader2 className="animate-spin h-4 w-4" /> : <UserPlus className="h-4 w-4 mr-2" />}
              {isSending ? 'Enviando...' : 'Agregar'}
            </Button>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="animate-spin h-8 w-8 text-primary" />
            </div>
          ) : (
            <>
              {/* Superintendentes activos */}
              {superintendents.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Superintendentes Activos
                  </h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nombre</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {superintendents.map(s => (
                        <TableRow key={s.id}>
                          <TableCell className="font-medium">{s.firstName} {s.lastName}</TableCell>
                          <TableCell>{s.email}</TableCell>
                          <TableCell>
                            <Badge className="bg-green-500 hover:bg-green-500/80">Activo</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => confirmDelete(s, 'superintendent')}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Invitaciones pendientes */}
              {invitations.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <Clock className="h-4 w-4 text-yellow-500" />
                    Invitaciones Pendientes
                  </h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invitations.map(inv => (
                        <TableRow key={inv.id}>
                          <TableCell>{inv.email}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={
                              inv.status === 'accepted'
                                ? 'border-green-500/50 text-green-500'
                                : 'border-yellow-500/50 text-yellow-500'
                            }>
                              {inv.status === 'accepted' ? 'Aceptada' : 'Pendiente'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => confirmDelete(inv, 'invitation')}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {superintendents.length === 0 && invitations.length === 0 && (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No tienes superintendentes ni invitaciones aún. Agrega un correo arriba.
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Modal de confirmación */}
      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              {deleteType === 'invitation' ? 'Eliminar Invitación' : 'Remover Superintendente'}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-2">
            <p className="text-sm text-muted-foreground">
              {deleteType === 'invitation'
                ? 'Se eliminará la invitación y el correo no podrá vincularse a tu empresa.'
                : 'Se removerá al superintendente de tu empresa.'}
            </p>
            {itemToDelete && (
              <div className="rounded-lg border p-3 bg-muted/50 text-sm">
                <p><span className="font-semibold">Email:</span> {itemToDelete.email}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteModalOpen(false)} disabled={isDeleting}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
