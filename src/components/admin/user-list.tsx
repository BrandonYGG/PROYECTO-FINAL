'use client';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Users, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function UserList() {
  const firestore = useFirestore();
  
  const usersQuery = useMemoFirebase(() => {
    return query(
      collection(firestore, 'users'), 
      where('userType', '==', 'normal')
    );
  }, [firestore]);

  const { data: users, isLoading, error } = useCollection(usersQuery);

  return (
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center gap-2'>
          <Users className="h-5 w-5" />
          <span>Usuarios Personales</span>
        </CardTitle>
        <CardDescription>Lista de todas las cuentas personales (clientes finales).</CardDescription>
      </CardHeader>
      <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead>Estado</TableHead>
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
                      <span>Error al cargar usuarios.</span>
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && !error && users?.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.firstName} {user.lastName}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{user.phoneNumber || 'N/A'}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="capitalize">
                      {user.userType}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {!isLoading && !error && users?.length === 0 && (
                 <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                    No hay usuarios registrados con este perfil.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
      </CardContent>
    </Card>
  );
}