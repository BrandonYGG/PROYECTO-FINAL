'use client';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Users, AlertTriangle } from 'lucide-react';

export default function UserList() {
  const firestore = useFirestore();
  const usersCollectionRef = useMemoFirebase(() => collection(firestore, 'users'), [firestore]);
  const { data: users, isLoading, error } = useCollection(usersCollectionRef);

  return (
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center gap-2'>
          <Users className="h-5 w-5" />
          <span>Usuarios Personales</span>
        </CardTitle>
        <CardDescription>Lista de todos los usuarios con cuentas personales registrados.</CardDescription>
      </CardHeader>
      <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead>Tipo de Usuario</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center h-24">
                    <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                  </TableCell>
                </TableRow>
              )}
              {error && (
                 <TableRow>
                  <TableCell colSpan={4} className="text-center h-24 text-destructive">
                    <div className="flex items-center justify-center gap-2">
                      <AlertTriangle className="h-5 w-5"/>
                      <span>Error al cargar usuarios: Permisos insuficientes.</span>
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && !error && users?.filter(u => u.userType === 'normal').map((user) => (
                <TableRow key={user.id}>
                  <TableCell>{user.firstName} {user.lastName}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{user.phoneNumber || 'No disponible'}</TableCell>
                  <TableCell className="capitalize">{user.userType}</TableCell>
                </TableRow>
              ))}
              {!isLoading && !error && users?.filter(u => u.userType === 'normal').length === 0 && (
                 <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                    No se encontraron usuarios personales.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
      </CardContent>
    </Card>
  );
}
