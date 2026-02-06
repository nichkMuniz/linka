import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";
import {
  ExternalLink,
  Search,
  Instagram,
  Tag,
  ChevronDown,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

// Placeholder type - will be replaced with database type
interface StoreCatalogItem {
  id: string;
  store_id: string;
  store_name: string;
  store_instagram_handle: string;
  store_instagram_profile_url: string;
  store_logo_url?: string;
  item_name: string;
  category: string;
  description?: string;
  price?: number;
  available_colors?: string[];
  available_sizes?: string[];
  item_photo_url: string;
  instagram_post_url: string;
}

export default function Store() {
  const [items, setItems] = React.useState<StoreCatalogItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [categoryFilter, setCategoryFilter] = React.useState<string | "all">(
    "all",
  );

  // For now, showing mock data structure
  const mockItems: StoreCatalogItem[] = [
    {
      id: "1",
      store_id: "store-1",
      store_name: "FitWear Pro",
      store_instagram_handle: "fitwearpro",
      store_instagram_profile_url: "https://instagram.com/fitwearpro",
      store_logo_url: "",
      item_name: "Camiseta Básica",
      category: "Camiseta",
      description: "Camiseta 100% algodão fitness",
      price: 79.9,
      available_colors: ["Preto", "Branco", "Cinza"],
      available_sizes: ["P", "M", "G", "GG"],
      item_photo_url:
        "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&h=500&fit=crop",
      instagram_post_url: "https://instagram.com/p/example1",
    },
    {
      id: "2",
      store_id: "store-1",
      store_name: "FitWear Pro",
      store_instagram_handle: "fitwearpro",
      store_instagram_profile_url: "https://instagram.com/fitwearpro",
      item_name: "Legging Premium",
      category: "Legging",
      description: "Legging de alta compressão",
      price: 189.9,
      available_colors: ["Preto", "Azul Marinho"],
      available_sizes: ["P", "M", "G"],
      item_photo_url:
        "https://images.unsplash.com/photo-1506629082632-ee5e4dae1a59?w=400&h=500&fit=crop",
      instagram_post_url: "https://instagram.com/p/example2",
    },
    {
      id: "3",
      store_id: "store-2",
      store_name: "Athletic Gear",
      store_instagram_handle: "athleticgear",
      store_instagram_profile_url: "https://instagram.com/athleticgear",
      item_name: "Short de Treino",
      category: "Shorts",
      description: "Short leve com bolsos",
      price: 89.9,
      available_colors: ["Preto", "Azul", "Vermelho"],
      available_sizes: ["P", "M", "G", "GG"],
      item_photo_url:
        "https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=400&h=500&fit=crop",
      instagram_post_url: "https://instagram.com/p/example3",
    },
    {
      id: "4",
      store_id: "store-2",
      store_name: "Athletic Gear",
      store_instagram_handle: "athleticgear",
      store_instagram_profile_url: "https://instagram.com/athleticgear",
      item_name: "Tênis Running",
      category: "Calçados",
      description: "Tênis esportivo profissional",
      price: 299.9,
      available_colors: ["Branco", "Preto", "Azul"],
      available_sizes: [
        "34",
        "35",
        "36",
        "37",
        "38",
        "39",
        "40",
        "41",
        "42",
        "43",
      ],
      item_photo_url:
        "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&h=500&fit=crop",
      instagram_post_url: "https://instagram.com/p/example4",
    },
    {
      id: "5",
      store_id: "store-3",
      store_name: "Yoga Essentials",
      store_instagram_handle: "yogaessentials",
      store_instagram_profile_url: "https://instagram.com/yogaessentials",
      item_name: "Top Esportivo",
      category: "Top",
      description: "Top com suporte alto para yoga",
      price: 119.9,
      available_colors: ["Branco", "Rosa", "Roxo"],
      available_sizes: ["P", "M", "G"],
      item_photo_url:
        "https://images.unsplash.com/photo-1506629082632-ee5e4dae1a59?w=400&h=500&fit=crop",
      instagram_post_url: "https://instagram.com/p/example5",
    },
    {
      id: "6",
      store_id: "store-3",
      store_name: "Yoga Essentials",
      store_instagram_handle: "yogaessentials",
      store_instagram_profile_url: "https://instagram.com/yogaessentials",
      item_name: "Tapete de Yoga",
      category: "Acessórios",
      description: "Tapete antiderrapante premium",
      price: 159.9,
      available_colors: ["Roxo", "Verde", "Cinza"],
      available_sizes: ["Único"],
      item_photo_url:
        "https://images.unsplash.com/photo-1524438549888-9c1efab60aae?w=400&h=500&fit=crop",
      instagram_post_url: "https://instagram.com/p/example6",
    },
  ];

  React.useEffect(() => {
    // TODO: Replace with actual database fetch when table is created
    // const loadItems = async () => {
    //   try {
    //     setLoading(true);
    //     const data = await getStoreCatalogDb(categoryFilter);
    //     setItems(data);
    //   } catch (err) {
    //     console.error("Error loading store items:", err);
    //     toast({
    //       title: "Erro ao carregar loja",
    //       description: "Tente novamente.",
    //       variant: "destructive",
    //     });
    //   } finally {
    //     setLoading(false);
    //   }
    // };
    // loadItems();

    // Using mock data for now
    setItems(mockItems);
  }, [categoryFilter]);

  const filteredItems = items.filter((item) => {
    const matchesSearch =
      item.item_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.store_name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const categories = Array.from(
    new Set(items.map((item) => item.category)),
  ).sort();

  const groupedByStore = filteredItems.reduce(
    (acc, item) => {
      if (!acc[item.store_id]) {
        acc[item.store_id] = {
          store_name: item.store_name,
          store_instagram_handle: item.store_instagram_handle,
          store_instagram_profile_url: item.store_instagram_profile_url,
          store_logo_url: item.store_logo_url,
          items: [],
        };
      }
      acc[item.store_id].items.push(item);
      return acc;
    },
    {} as Record<
      string,
      {
        store_name: string;
        store_instagram_handle: string;
        store_instagram_profile_url: string;
        store_logo_url?: string;
        items: StoreCatalogItem[];
      }
    >,
  );

  return (
    <div className="mx-auto grid w-full max-w-4xl gap-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Loja Fitness</h1>
        <p className="text-sm text-muted-foreground">
          Descubra roupas fitness de parceiros incríveis.
        </p>
      </div>

      {/* Search and Filter Section */}
      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar produtos ou lojas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 rounded-full"
            />
          </div>

          {categories.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0 rounded-full gap-1"
                >
                  <Tag className="h-4 w-4" />
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={() => setCategoryFilter("all")}
                  className={categoryFilter === "all" ? "bg-muted" : ""}
                >
                  Todos
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {categories.map((category) => (
                  <DropdownMenuItem
                    key={category}
                    onClick={() => setCategoryFilter(category)}
                    className={categoryFilter === category ? "bg-muted" : ""}
                  >
                    {category}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Stores and Products Grid */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">
          Carregando produtos...
        </div>
      ) : Object.keys(groupedByStore).length > 0 ? (
        <div className="space-y-8">
          {Object.values(groupedByStore).map((store, storeIndex) => (
            <div key={storeIndex} className="space-y-4">
              {/* Products Grid */}
              <div className="grid gap-3 grid-cols-2">
                {store.items.map((item) => (
                  <Card
                    key={item.id}
                    className="border-border/60 hover:border-border/80 transition-all overflow-hidden group"
                  >
                    {/* Product Image */}
                    <div className="relative aspect-square overflow-hidden bg-muted">
                      <img
                        src={item.item_photo_url}
                        alt={item.item_name}
                        className="h-full w-full object-cover group-hover:scale-110 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                    </div>

                    {/* Product Info */}
                    <CardContent className="p-4 space-y-3">
                      <div className="space-y-1">
                        <p className="text-xs text-brand font-medium">
                          {item.category}
                        </p>
                        <p className="font-semibold text-sm line-clamp-2">
                          {item.item_name}
                        </p>
                        {item.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {item.description}
                          </p>
                        )}
                      </div>

                      {/* Price and Instagram Link */}
                      <div className="flex items-center justify-between gap-2">
                        {item.price && (
                          <p className="font-bold text-lg text-brand">
                            R$ {item.price.toFixed(2)}
                          </p>
                        )}
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-muted-foreground">
                            @{item.store_instagram_handle}
                          </span>
                          <a
                            href={item.instagram_post_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-shrink-0 p-2 hover:bg-muted rounded-lg transition"
                            title="Ver no Instagram"
                          >
                            <Instagram className="h-4 w-4 text-pink-500" />
                          </a>
                        </div>
                      </div>

                      {/* Variants */}
                      {(item.available_colors || item.available_sizes) && (
                        <div className="text-xs text-muted-foreground space-y-1">
                          {item.available_colors && (
                            <p>
                              Cores:{" "}
                              <span className="font-medium">
                                {item.available_colors.join(", ")}
                              </span>
                            </p>
                          )}
                          {item.available_sizes && (
                            <p>
                              Tamanhos:{" "}
                              <span className="font-medium">
                                {item.available_sizes.join(", ")}
                              </span>
                            </p>
                          )}
                        </div>
                      )}

                      {/* Visit Store Button */}
                      <a
                        href={store.store_instagram_profile_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full mt-2"
                      >
                        <Button
                          variant="outline"
                          className="w-full rounded-full gap-2 text-xs h-8"
                        >
                          <Instagram className="h-3 w-3" />
                          Visitar {store.store_name}
                        </Button>
                      </a>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-border/60 bg-muted/30 p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Nenhum produto encontrado. Tente ajustar sua busca.
          </p>
        </div>
      )}
    </div>
  );
}
