import { useEffect, useState } from "react";
import { supabase, AbbreModel, TestType } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AbbreModelFormDialog } from "@/components/AbbreModelFormDialog";
import { Toaster as SonnerToaster, toast as sonnerToast } from "sonner";
import {
  PlusCircle,
  Eye,
  Trash2,
  Edit,
  Loader2,
  AlertTriangle,
  FolderOpen,
} from "lucide-react";

function AbbrevManagementPage() {
  const [abbreModels, setAbbreModels] = useState<AbbreModel[]>([]);
  const [selectedAbbreModel, setSelectedAbbreModel] =
    useState<AbbreModel | null>(null);
  const [associatedTestTypes, setAssociatedTestTypes] = useState<TestType[]>(
    []
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAbbreModel, setEditingAbbreModel] = useState<AbbreModel | null>(
    null
  );

  const fetchAbbreModels = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("abbre_models")
      .select("*")
      .order("name");
    if (error) {
      sonnerToast.error(
        "Erreur lors de la récupération des modèles d'abréviation",
        {
          description: error.message,
        }
      );
    } else {
      setAbbreModels(data || []);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchAbbreModels();
  }, []);

  const fetchAssociatedTestTypes = async (abbreModel: AbbreModel) => {
    if (!abbreModel) return;
    setIsLoadingDetails(true);
    setSelectedAbbreModel(abbreModel);
    setAssociatedTestTypes([]);

    const { data, error } = await supabase
      .from("test_type")
      .select("id, name")
      .like("name", `%${abbreModel.name}%`);

    if (error) {
      sonnerToast.error("Erreur lors de la récupération des types de test", {
        description: error.message,
      });
      setAssociatedTestTypes([]);
    } else {
      setAssociatedTestTypes(
        (data || []).filter((tt) => tt.name.includes(abbreModel.name))
      );
    }
    setIsLoadingDetails(false);
  };

  const handleFormSuccess = () => {
    fetchAbbreModels();
    setIsFormOpen(false);
    const message = editingAbbreModel
      ? "Modèle d'abréviation mis à jour avec succès."
      : "Modèle d'abréviation créé avec succès.";
    sonnerToast.success("Opération réussie", { description: message });
    setEditingAbbreModel(null);

    if (selectedAbbreModel) {
      const updatedSelectedModel = abbreModels.find(
        (am) => am.id === selectedAbbreModel.id
      );
      if (updatedSelectedModel) {
        fetchAssociatedTestTypes(updatedSelectedModel);
      } else {
        setSelectedAbbreModel(null);
        setAssociatedTestTypes([]);
      }
    }
  };

  const handleCreateNew = () => {
    setEditingAbbreModel(null);
    setIsFormOpen(true);
  };

  const handleEdit = (model: AbbreModel) => {
    setEditingAbbreModel(model);
    setIsFormOpen(true);
  };

  const handleDelete = async (model: AbbreModel) => {
    if (
      !window.confirm(
        `Êtes-vous sûr de vouloir supprimer "${model.name}" ? Les occurrences de "${model.name}" dans les noms des types de test associés seront retirées.`
      )
    ) {
      return;
    }
    setIsLoading(true);

    const nameToRemove = model.name;

    const { data: typesToUpdate, error: fetchError } = await supabase
      .from("test_type")
      .select("id, name")
      .like("name", `%${nameToRemove}%`);

    if (fetchError) {
      sonnerToast.error(
        "Erreur lors de la récupération des types de test pour la désassociation",
        {
          description: fetchError.message,
        }
      );
      setIsLoading(false);
      return;
    }

    const updates: Promise<any>[] = (typesToUpdate || [])
      .filter((tt) => tt.name.includes(nameToRemove))
      .map((tt) => {
        const newName = tt.name.replace(nameToRemove, "").trim();
        return supabase
          .from("test_type")
          .update({ name: newName })
          .eq("id", tt.id);
      });

    if (updates.length > 0) {
      try {
        const results = await Promise.allSettled(updates);
        const successfulUpdates = results.filter(
          (r) => r.status === "fulfilled"
        ).length;
        if (successfulUpdates > 0) {
          sonnerToast.success("Types de test mis à jour", {
            description: `"${nameToRemove}" retiré de ${successfulUpdates} type(s) de test.`,
          });
        }
        const failedUpdates = results.filter(
          (r) => r.status === "rejected"
        ).length;
        if (failedUpdates > 0) {
          sonnerToast.error(
            `Erreur lors de la mise à jour de ${failedUpdates} types de test.`,
            {
              description:
                "Certains types de test n'ont pas pu être mis à jour.",
            }
          );
        }
      } catch (error: any) {
        sonnerToast.error(
          "Erreur lors de la mise à jour par lot des types de test",
          {
            description: error.message,
          }
        );
      }
    }

    const { error: deleteError } = await supabase
      .from("abbre_models")
      .delete()
      .eq("id", model.id);
    if (deleteError) {
      sonnerToast.error(
        "Erreur lors de la suppression du modèle d'abréviation",
        {
          description: deleteError.message,
        }
      );
    } else {
      sonnerToast.success("Modèle d'abréviation supprimé", {
        description: `"${model.name}" a été retiré.`,
      });
      fetchAbbreModels();
      if (selectedAbbreModel?.id === model.id) {
        setSelectedAbbreModel(null);
        setAssociatedTestTypes([]);
      }
    }
    setIsLoading(false);
  };

  // Light theme specific classes
  const cardClasses = "bg-white border border-slate-200 shadow-lg rounded-xl";
  const textMutedClasses = "text-slate-500";
  const titleClasses = "text-2xl font-semibold text-slate-700";
  const tableHeaderClasses =
    "text-slate-700 uppercase tracking-wider font-semibold";
  const tableRowHoverClasses = "hover:bg-slate-50";
  const tableRowSelectedClasses = "bg-slate-100 hover:bg-slate-200/70";

  return (
    <div className="min-h-screen text-slate-900 p-4 sm:p-6 md:p-8">
      <SonnerToaster richColors position="top-right" theme="light" />
      <div className="container mx-auto">
        <h1 className="text-4xl font-extrabold mb-8 text-slate-700 tracking-tight text-center sm:text-left">
          Gestion des Modèles d'Abréviation
        </h1>

        <div className="mb-8">
          <Button
            onClick={handleCreateNew}
            disabled={isLoading}
            size="lg"
            // className="bg-slate-500 hover:bg-slate-600 text-white shadow-md hover:shadow-lg transition-all duration-300 rounded-lg"
          >
            <PlusCircle className="mr-2 h-5 w-5" /> Créer un Nouveau Modèle
            Abbr.
          </Button>
        </div>

        {isFormOpen && (
          <AbbreModelFormDialog
            isOpen={isFormOpen}
            onClose={() => {
              setIsFormOpen(false);
              setEditingAbbreModel(null);
            }}
            onSuccess={handleFormSuccess}
            initialData={editingAbbreModel}
            // Assuming AbbreModelFormDialog is also theme-aware or will adapt
          />
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1">
            <Card className={cardClasses}>
              <CardHeader>
                <CardTitle className={titleClasses}>
                  Modèles d'Abréviation
                </CardTitle>
                <CardDescription className={textMutedClasses}>
                  Cliquez sur un modèle pour voir les types de test associés.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                {" "}
                {/* Removed default CardContent padding-top */}
                {isLoading && abbreModels.length === 0 && (
                  <div className="flex flex-col items-center justify-center p-10 text-slate-500">
                    <Loader2 className="h-8 w-8 animate-spin text-slate-600 mb-3" />
                    <p>Chargement des modèles...</p>
                  </div>
                )}
                {!isLoading && abbreModels.length === 0 && (
                  <div className="flex flex-col items-center justify-center p-10 text-slate-500 text-center">
                    <FolderOpen className="h-10 w-10 text-slate-400 mb-3" />
                    <p className="font-medium">
                      Aucun modèle d'abréviation trouvé.
                    </p>
                    <p className="text-sm">
                      Cliquez sur le bouton ci-dessus pour en créer un.
                    </p>
                  </div>
                )}
                {abbreModels.length > 0 && (
                  <Table>
                    <TableHeader>
                      <TableRow className="border-b-slate-200">
                        <TableHead className={tableHeaderClasses}>
                          Nom
                        </TableHead>
                        <TableHead
                          className={`${tableHeaderClasses} text-right`}
                        >
                          Actions
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {abbreModels.map((model) => (
                        <TableRow
                          key={model.id}
                          className={`border-b-slate-200 transition-colors ${
                            selectedAbbreModel?.id === model.id
                              ? tableRowSelectedClasses
                              : tableRowHoverClasses
                          }`}
                        >
                          <TableCell
                            className="font-medium text-slate-700 cursor-pointer py-3"
                            onClick={() => fetchAssociatedTestTypes(model)}
                          >
                            {model.name}
                          </TableCell>
                          <TableCell className="flex gap-1 justify-end py-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => fetchAssociatedTestTypes(model)}
                              title="Voir Associés"
                              className="text-slate-600 hover:text-slate-700 hover:bg-slate-200 rounded-md"
                              disabled={
                                isLoadingDetails &&
                                selectedAbbreModel?.id === model.id
                              }
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(model)}
                              title="Modifier"
                              className="text-amber-500 hover:text-amber-600 hover:bg-slate-200 rounded-md"
                              disabled={isLoading}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            {/* <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(model)}
                              title="Supprimer"
                              className="text-red-500 hover:text-red-600 hover:bg-red-100 rounded-md"
                              disabled={isLoading}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button> */}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="md:col-span-2">
            {selectedAbbreModel && (
              <Card className={cardClasses}>
                <CardHeader>
                  <CardTitle className={titleClasses}>
                    Types de Test Associés pour "{selectedAbbreModel.name}"
                  </CardTitle>
                  <CardDescription className={textMutedClasses}>
                    Types de test dont le nom inclut "
                    <strong>{selectedAbbreModel.name}</strong>".
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  {isLoadingDetails && (
                    <div className="flex flex-col items-center justify-center p-10 text-slate-500">
                      <Loader2 className="h-8 w-8 animate-spin text-slate-600 mb-3" />
                      <p>Chargement des types de test...</p>
                    </div>
                  )}
                  {!isLoadingDetails && associatedTestTypes.length === 0 && (
                    <div className="flex flex-col items-center justify-center p-10 text-slate-500 text-center">
                      <AlertTriangle className="h-10 w-10 text-amber-500 mb-3" />
                      <p className="font-medium">
                        Aucun type de test associé trouvé pour ce modèle.
                      </p>
                    </div>
                  )}
                  {!isLoadingDetails && associatedTestTypes.length > 0 && (
                    <Table>
                      <TableHeader>
                        <TableRow className="border-b-slate-200">
                          <TableHead className={tableHeaderClasses}>
                            Nom du Type de Test
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {associatedTestTypes.map((tt) => (
                          <TableRow
                            key={tt.id}
                            className={`border-b-slate-200 ${tableRowHoverClasses}`}
                          >
                            <TableCell className="text-slate-700 py-3">
                              {tt.name}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            )}
            {!selectedAbbreModel && !isLoading && (
              <div
                className={`flex flex-col items-center justify-center p-10 text-center rounded-xl h-full ${cardClasses}`}
              >
                <Eye className="h-12 w-12 text-slate-500 mb-4" />
                <p className="text-lg font-semibold text-slate-700">
                  Sélectionnez un Modèle
                </p>
                <p className={textMutedClasses}>
                  Cliquez sur un modèle dans la liste de gauche pour afficher
                  ses détails ici.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AbbrevManagementPage;

// simple modes just viewable

// import { useEffect, useState } from "react";
// import { supabase, AbbreModel, TestType } from "@/lib/supabaseClient"; // Ajustez le chemin si nécessaire
// import {
//   Card,
//   CardContent,
//   CardDescription,
//   CardHeader,
//   CardTitle,
// } from "@/components/ui/card";
// import {
//   Table,
//   TableBody,
//   TableCell,
//   TableHead,
//   TableHeader,
//   TableRow,
// } from "@/components/ui/table";
// import { ScrollArea } from "@/components/ui/scroll-area";
// import { Badge } from "@/components/ui/badge";
// import { Toaster as SonnerToaster, toast as sonnerToast } from "sonner";
// import { ListChecks, FileText, Loader2, SearchX } from "lucide-react"; // Icônes

// function AbbreManagementPage() {
//   const [abbreModels, setAbbreModels] = useState<AbbreModel[]>([]);
//   const [selectedAbbreModel, setSelectedAbbreModel] =
//     useState<AbbreModel | null>(null);
//   const [associatedTestTypes, setAssociatedTestTypes] = useState<TestType[]>(
//     []
//   );
//   const [isLoadingModels, setIsLoadingModels] = useState(true);
//   const [isLoadingTestTypes, setIsLoadingTestTypes] = useState(false);

//   // Récupérer tous les modèles d'abréviation au montage du composant
//   useEffect(() => {
//     const fetchAbbreModels = async () => {
//       setIsLoadingModels(true);
//       const { data, error } = await supabase
//         .from("abbre_models")
//         .select("*")
//         .order("name", { ascending: true });

//       if (error) {
//         sonnerToast.error("Échec du chargement des modèles", {
//           description: error.message,
//         });
//         setAbbreModels([]);
//       } else {
//         setAbbreModels(data || []);
//       }
//       setIsLoadingModels(false);
//     };

//     fetchAbbreModels();
//   }, []);

//   // Gérer la sélection d'un modèle d'abréviation et récupérer ses types de test associés
//   const handleSelectAbbreModel = async (model: AbbreModel) => {
//     if (selectedAbbreModel?.id === model.id) {
//       return; // Déjà sélectionné
//     }

//     setSelectedAbbreModel(model);
//     setAssociatedTestTypes([]); // Effacer les résultats précédents
//     setIsLoadingTestTypes(true);

//     const { data, error } = await supabase
//       .from("test_type")
//       .select("id, name")
//       .like("name", `%${model.name}%`); // Le nom du type de test inclut le nom du modèle d'abréviation

//     if (error) {
//       sonnerToast.error(
//         `Échec du chargement des types de test pour ${model.name}`,
//         { description: error.message }
//       );
//       setAssociatedTestTypes([]);
//     } else {
//       setAssociatedTestTypes(
//         (data || []).filter((tt) => tt.name.includes(model.name))
//       );
//     }
//     setIsLoadingTestTypes(false);
//   };

//   const renderEmptyState = (
//     icon: React.ReactNode,
//     title: string,
//     description: string
//   ) => (
//     <div className="flex flex-col items-center justify-center text-center text-muted-foreground py-10">
//       <div className="mb-4 text-4xl">{icon}</div>
//       <h3 className="text-lg font-semibold">{title}</h3>
//       <p className="text-sm">{description}</p>
//     </div>
//   );

//   return (
//     <>
//       <SonnerToaster richColors position="top-right" />
//       <div className="min-h-screen bg-background text-foreground p-4 md:p-8">
//         <header className="mb-8 text-center">
//           <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
//             Visualiseur de Modèles d'Abréviation
//           </h1>
//           <p className="text-muted-foreground mt-2">
//             Parcourez les modèles et leurs types de test associés.
//           </p>
//         </header>

//         <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
//           {/* Liste des Modèles d'Abréviation */}
//           <Card className="md:col-span-1 h-fit md:sticky md:top-8">
//             <CardHeader>
//               <CardTitle className="flex items-center">
//                 <ListChecks className="mr-2 h-5 w-5 text-primary" />
//                 Modèles
//               </CardTitle>
//               <CardDescription>
//                 Sélectionnez un modèle pour voir ses détails.
//               </CardDescription>
//             </CardHeader>
//             <CardContent>
//               {isLoadingModels ? (
//                 <div className="flex items-center justify-center py-10">
//                   <Loader2 className="h-8 w-8 animate-spin text-primary" />
//                   <p className="ml-2">Chargement des modèles...</p>
//                 </div>
//               ) : abbreModels.length > 0 ? (
//                 <ScrollArea className="h-[calc(100vh-200px)] md:h-[60vh] pr-3">
//                   <ul className="space-y-2">
//                     {abbreModels.map((model) => (
//                       <li key={model.id}>
//                         <button
//                           onClick={() => handleSelectAbbreModel(model)}
//                           className={`w-full text-left px-4 py-3 rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
//                             ${
//                               selectedAbbreModel?.id === model.id
//                                 ? "bg-primary text-primary-foreground hover:bg-primary/90"
//                                 : "bg-muted hover:bg-muted/80"
//                             }`}
//                         >
//                           <span className="font-medium">{model.name}</span>
//                           {model.description && (
//                             <p
//                               className={`text-xs mt-1 ${
//                                 selectedAbbreModel?.id === model.id
//                                   ? "text-primary-foreground/80"
//                                   : "text-muted-foreground"
//                               }`}
//                             >
//                               {model.description}
//                             </p>
//                           )}
//                         </button>
//                       </li>
//                     ))}
//                   </ul>
//                 </ScrollArea>
//               ) : (
//                 renderEmptyState(
//                   <SearchX />,
//                   "Aucun Modèle Trouvé",
//                   "Aucun modèle d'abréviation n'est disponible."
//                 )
//               )}
//             </CardContent>
//           </Card>

//           {/* Types de Test Associés */}
//           <Card className="md:col-span-2">
//             <CardHeader>
//               <CardTitle className="flex items-center">
//                 <FileText className="mr-2 h-5 w-5 text-primary" />
//                 Types de Test Associés
//               </CardTitle>
//               <CardDescription>
//                 {selectedAbbreModel
//                   ? `Affichage des types de test associés à "${selectedAbbreModel.name}"`
//                   : "Sélectionnez un modèle dans la liste pour voir ses types de test associés."}
//               </CardDescription>
//             </CardHeader>
//             <CardContent className="min-h-[200px]">
//               {!selectedAbbreModel ? (
//                 renderEmptyState(
//                   <SearchX />,
//                   "Aucun Modèle Sélectionné",
//                   "Veuillez sélectionner un modèle dans la liste de gauche."
//                 )
//               ) : isLoadingTestTypes ? (
//                 <div className="flex items-center justify-center py-10">
//                   <Loader2 className="h-8 w-8 animate-spin text-primary" />
//                   <p className="ml-2">Chargement des types de test...</p>
//                 </div>
//               ) : associatedTestTypes.length > 0 ? (
//                 <ScrollArea className="h-[calc(100vh-220px)] md:h-[60vh]">
//                   <Table>
//                     <TableHeader>
//                       <TableRow>
//                         <TableHead>Nom du Type de Test</TableHead>
//                       </TableRow>
//                     </TableHeader>
//                     <TableBody>
//                       {associatedTestTypes.map((tt) => (
//                         <TableRow key={tt.id}>
//                           <TableCell>
//                             {tt.name
//                               .split(selectedAbbreModel.name)
//                               .map((part, index, array) => (
//                                 <span key={index}>
//                                   {part}
//                                   {index < array.length - 1 && (
//                                     <Badge
//                                       variant="secondary"
//                                       className="mx-1 font-semibold bg-primary/10 text-primary border-primary/30"
//                                     >
//                                       {selectedAbbreModel.name}
//                                     </Badge>
//                                   )}
//                                 </span>
//                               ))}
//                           </TableCell>
//                         </TableRow>
//                       ))}
//                     </TableBody>
//                   </Table>
//                 </ScrollArea>
//               ) : (
//                 renderEmptyState(
//                   <SearchX />,
//                   "Aucun Type de Test Associé",
//                   `Aucun type de test incluant "${selectedAbbreModel.name}" n'a été trouvé.`
//                 )
//               )}
//             </CardContent>
//           </Card>
//         </div>
//       </div>
//     </>
//   );
// }

// export default AbbrevManagementPage;
