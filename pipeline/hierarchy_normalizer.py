import re
import pandas as pd
import numpy as np
from typing import List, Dict, Tuple, Optional, Any
try:
    from .table_cleaners import (
        clean_text_cell,
        parse_indonesian_number,
        is_dimension_column,
        detect_and_clean_metadata,
        deduplicate_columns
    )
except ImportError:
    from table_cleaners import (
        clean_text_cell,
        parse_indonesian_number,
        is_dimension_column,
        detect_and_clean_metadata,
        deduplicate_columns
    )

def apply_modifications(df: pd.DataFrame, mods: Dict) -> pd.DataFrame:
    """
    Applies row and column modifications to a DataFrame based on a configuration.
    Supports both integer-based and data-aware positioning.
    """
    if not isinstance(df, pd.DataFrame):
        return df

    # --- Apply Column Additions ---
    if "add_columns" in mods:
        cols_to_insert = []
        
        # 1. Resolve all column positions into a list of (index, name, values)
        for col_mod in mods["add_columns"]:
            name = col_mod.get("name")
            if not name or name in df.columns:
                logging.warning(f"Skipping adding column '{name}' (name missing or already exists).")
                continue

            pos_config = col_mod.get("position", "end")
            idx = -1

            if pos_config == "start":
                idx = 0
            elif pos_config == "end":
                idx = len(df.columns)
            elif isinstance(pos_config, int):
                idx = pos_config
            elif isinstance(pos_config, dict):
                try:
                    col_list = list(df.columns)
                    if "after_column" in pos_config:
                        target_col = pos_config["after_column"]
                        target_idx = col_list.index(target_col)
                        idx = target_idx + 1
                    elif "before_column" in pos_config:
                        target_col = pos_config["before_column"]
                        idx = col_list.index(target_col)
                    else:
                        logging.warning(f"Invalid column position config for '{name}': {pos_config}")
                except (ValueError, KeyError) as e:
                    logging.error(f"Could not find target column for '{name}': {e}. Skipping.")
            else:
                logging.warning(f"Unknown position type '{pos_config}' for column '{name}'. Skipping.")

            if idx != -1:
                # Prepare column data
                num_rows = len(df)
                values_config = col_mod.get("values", "")
                if isinstance(values_config, list) and len(values_config) == num_rows:
                    col_data = values_config
                elif values_config == "range":
                    col_data = range(1, num_rows + 1)
                else:  # Broadcast a single value
                    col_data = [values_config] * num_rows
                
                cols_to_insert.append((idx, name, col_data))

        # 2. Sort by index descending and insert
        cols_to_insert.sort(key=lambda x: x[0], reverse=True)
        for idx, name, values in cols_to_insert:
            # Clamp index to be within bounds
            final_idx = min(idx, len(df.columns))
            df.insert(final_idx, name, values)
            logging.info(f"Inserted column '{name}' at index {final_idx}.")

    # Short-circuit if DataFrame becomes empty (e.g. via modifications)
    if df.empty:
        return df

    # --- Apply Row Additions ---
    if "add_rows" in mods:
        rows_to_insert = []

        # 1. Resolve all row positions into a list of (index, data)
        for row_mod in mods["add_rows"]:
            data = row_mod.get("data", {})
            pos_config = row_mod.get("position", "end")
            idx = -1

            if pos_config == "start":
                idx = 0
            elif pos_config == "end":
                idx = len(df)
            elif isinstance(pos_config, int):
                idx = pos_config
            elif isinstance(pos_config, dict):
                try:
                    if "after_row" in pos_config:
                        target_spec = pos_config["after_row"]
                        target_col, target_val = target_spec["column"], target_spec["value"]
                        # Find first match, convert both to string for safe comparison
                        matches = df.index[df[target_col].astype(str) == str(target_val)].tolist()
                        if matches:
                            idx = matches[0] + 1
                        else:
                            logging.warning(f"Could not find row where '{target_col}' is '{target_val}'. Appending to end.")
                            idx = len(df)
                    elif "before_row" in pos_config:
                        target_spec = pos_config["before_row"]
                        target_col, target_val = target_spec["column"], target_spec["value"]
                        matches = df.index[df[target_col].astype(str) == str(target_val)].tolist()
                        if matches:
                            idx = matches[0]
                        else:
                            logging.warning(f"Could not find row where '{target_col}' is '{target_val}'. Appending to end.")
                            idx = len(df)
                    else:
                        logging.warning(f"Invalid row position config: {pos_config}. Appending to end.")
                        idx = len(df)
                except KeyError as e:
                    logging.error(f"Invalid key in row position config: {e}. Appending to end.")
                    idx = len(df)
            else:
                logging.warning(f"Unknown position type '{pos_config}' for row. Appending to end.")
                idx = len(df)

            if idx != -1:
                rows_to_insert.append((idx, data))

        # 2. Sort by index descending and insert
        rows_to_insert.sort(key=lambda x: x[0], reverse=True)
        for idx, data in rows_to_insert:
            row_df = pd.DataFrame([data])
            # Clamp index
            final_idx = min(idx, len(df))
            df = pd.concat([df.iloc[:final_idx], row_df, df.iloc[final_idx:]]).reset_index(drop=True)
            logging.info(f"Inserted row at index {final_idx}.")
            
    # Final cleanup of NaNs that may have been introduced
    df.fillna("", inplace=True)

    return df

def normalize_key_text(val) -> str:
    if val is None or pd.isna(val):
        return ""
    val = str(val).strip().lower()
    val = re.sub(r'^\s*[\d\.]+\s*', '', val)
    val = re.sub(r'[^a-z0-9]', '', val)
    return val

def is_total_row_key(key_norm: str) -> bool:
    return key_norm in ['total', 'jumlah', 'kabupatentasikmalaya', 'kabtasikmalaya', 'tasikmalaya', 'seluruhnya']

def clean_subtable_rows(df: pd.DataFrame) -> pd.DataFrame:
    if df is None or df.empty:
        return pd.DataFrame()
    df = df.copy().reset_index(drop=True)
    
    # Bersihkan kolom bising "Kolom_Kosong" yang tidak berisi data
    for col in list(df.columns):
        if str(col).startswith("Kolom_Kosong"):
            data_slice = df[col].iloc[2:] if len(df) > 2 else df[col]
            is_empty = data_slice.isna().all() or data_slice.astype(str).str.strip().replace(['nan', '-', ''], None).isna().all()
            if is_empty:
                df = df.drop(columns=[col])
                
    rows_to_drop = []
    for r_idx in range(len(df)):
        key_val = str(df.iloc[r_idx, 0]).strip()
        if not key_val:
            non_empty_cells = [x for x in df.iloc[r_idx, 1:] if str(x).strip() not in ['', '-', '.', 'None', 'nan']]
            if not non_empty_cells:
                rows_to_drop.append(r_idx)
            else:
                if r_idx + 1 < len(df) and is_total_row_key(normalize_key_text(df.iloc[r_idx + 1, 0])):
                    for c_idx in range(1, len(df.columns)):
                        val = str(df.iloc[r_idx, c_idx]).strip()
                        if val not in ['', '-', '.', 'None', 'nan']:
                            df.iloc[r_idx + 1, c_idx] = df.iloc[r_idx, c_idx]
                    rows_to_drop.append(r_idx)
                elif r_idx > 0 and is_total_row_key(normalize_key_text(df.iloc[r_idx - 1, 0])):
                    for c_idx in range(1, len(df.columns)):
                        val = str(df.iloc[r_idx, c_idx]).strip()
                        if val not in ['', '-', '.', 'None', 'nan']:
                            df.iloc[r_idx - 1, c_idx] = df.iloc[r_idx, c_idx]
                    rows_to_drop.append(r_idx)
    if rows_to_drop:
        df = df.drop(index=rows_to_drop).reset_index(drop=True)
    return df

def is_continuation_of_vertical_block(current_dfs: List[pd.DataFrame], next_df: pd.DataFrame) -> bool:
    if not current_dfs or next_df.empty:
        return False
    curr_keys = set()
    for d in current_dfs:
        for x in d.iloc[:, 0]:
            k = normalize_key_text(x)
            if k and not is_total_row_key(k):
                curr_keys.add(k)
                
    start_key_next = normalize_key_text(next_df.iloc[0, 0])
    if not start_key_next or is_total_row_key(start_key_next):
        return True
    if start_key_next in curr_keys:
        return False
    return True

def merge_subtables_for_table_group(table_sub_list: List[Dict]) -> tuple:
    if not table_sub_list:
        return pd.DataFrame(), []
        
    cleaned_subs = []
    for sub in table_sub_list:
        df_cleaned = clean_subtable_rows(sub['dataframe'])
        if not df_cleaned.empty:
            cleaned_subs.append({
                'page': sub['page'],
                'dataframe': df_cleaned,
                'index_row': sub.get('index_row', []),
                'table_number': sub.get('table_number')
            })

    if not cleaned_subs:
        return pd.DataFrame(), []

    # Assemble vertical blocks
    vertical_blocks = []
    current_block_dfs = [cleaned_subs[0]['dataframe']]
    current_block_pages = [cleaned_subs[0]['page']]
    
    for i in range(1, len(cleaned_subs)):
        next_df = cleaned_subs[i]['dataframe']
        next_page = cleaned_subs[i]['page']
        
        if is_continuation_of_vertical_block(current_block_dfs, next_df):
            current_block_dfs.append(next_df)
            current_block_pages.append(next_page)
        else:
            stacked_df = pd.concat(current_block_dfs, ignore_index=True).reset_index(drop=True)
            vertical_blocks.append({
                'dataframe': stacked_df,
                'pages': current_block_pages
            })
            current_block_dfs = [next_df]
            current_block_pages = [next_page]
            
    if current_block_dfs:
        stacked_df = pd.concat(current_block_dfs, ignore_index=True).reset_index(drop=True)
        vertical_blocks.append({
            'dataframe': stacked_df,
            'pages': current_block_pages
        })

    if len(vertical_blocks) == 1:
        return vertical_blocks[0]['dataframe'], sorted(list(set(vertical_blocks[0]['pages'])))
        
    # Pick the vertical block with the most rows as base template
    max_block_idx = 0
    max_rows = len(vertical_blocks[0]['dataframe'])
    for idx, vb in enumerate(vertical_blocks):
        if len(vb['dataframe']) > max_rows:
            max_rows = len(vb['dataframe'])
            max_block_idx = idx
            
    base_block = vertical_blocks[max_block_idx]
    base_df = base_block['dataframe'].copy().reset_index(drop=True)
    all_pages = list(base_block['pages'])
    
    base_key_col = base_df.columns[0]
    base_keys_norm = [normalize_key_text(x) for x in base_df[base_key_col]]
    
    key_to_base_idx = {k: i for i, k in enumerate(base_keys_norm) if k and not is_total_row_key(k)}
    base_total_idx = next((i for i, k in enumerate(base_keys_norm) if is_total_row_key(k)), None)

    for vb_idx, vb in enumerate(vertical_blocks):
        if vb_idx == max_block_idx:
            continue
        v_df = vb['dataframe'].reset_index(drop=True)
        all_pages.extend(vb['pages'])
        v_key_col = v_df.columns[0]
        data_cols = [c for c in v_df.columns if c != v_key_col]
        
        seen_cols = set(base_df.columns)
        renamed_data_cols = []
        for c in data_cols:
            new_c = c
            counter = 1
            while new_c in seen_cols:
                new_c = f"{c}.{counter}"
                counter += 1
            seen_cols.add(new_c)
            renamed_data_cols.append((c, new_c))
            
        aligned_cols = {new_c: [""] * len(base_df) for _, new_c in renamed_data_cols}
        
        for r_idx in range(len(v_df)):
            k_norm = normalize_key_text(v_df.iloc[r_idx, 0])
            target_idx = None
            if k_norm in key_to_base_idx:
                target_idx = key_to_base_idx[k_norm]
            elif is_total_row_key(k_norm) and base_total_idx is not None:
                target_idx = base_total_idx
            elif r_idx < len(base_df):
                target_idx = r_idx
                
            if target_idx is not None and target_idx < len(base_df):
                for orig_c, new_c in renamed_data_cols:
                    aligned_cols[new_c][target_idx] = str(v_df.iloc[r_idx][orig_c])
                    
        for _, new_c in renamed_data_cols:
            base_df[new_c] = aligned_cols[new_c]
            
    return base_df, sorted(list(set(all_pages)))

def is_two_level_hierarchical_table(df: pd.DataFrame) -> bool:
    """
    Mendeteksi secara presisi tabel hierarki 2-level (Kategori Induk + Sub-Item Rincian)
    seperti Tabel 5.5.6 (Perikanan Tangkap/Budidaya) atau Tabel 8.1.4 (Moda Transportasi).
    Tabel reguler lainnya TIDAK AKAN disentuh.
    """
    if df is None or len(df.columns) < 3 or len(df) < 3:
        return False
    col0 = df.iloc[:, 0].astype(str).str.strip()
    col1 = df.iloc[:, 1].astype(str).str.strip()
    empty_col0_count = (col0 == '').sum()
    if empty_col0_count < 2:
        return False
    col1_non_empty_when_col0_empty = ((col0 == '') & (col1 != '')).sum()
    if col1_non_empty_when_col0_empty < 2:
        return False
    text_in_col1 = sum(1 for v in col1 if v and not re.sub(r'[\d.,\s\-]', '', v) == '')
    if text_in_col1 < 2:
        return False
    return True

def normalize_two_level_hierarchical_table(df: pd.DataFrame) -> pd.DataFrame:
    """
    Normalisasi tabel hierarki 2-level:
    Menggabungkan Kolom 0 (Sektor/Induk) dan Kolom 1 (Rincian/Sub-Item)
    menjadi entitas eksplisit yang atomic (misal: 'Perikanan Tangkap - Perikanan Laut').
    """
    if not is_two_level_hierarchical_table(df):
        return df
    col0_name = df.columns[0]
    data_cols = list(df.columns[2:])
    current_group = ''
    new_rows = []
    for r_idx in range(len(df)):
        c0_val = str(df.iloc[r_idx, 0]).strip()
        c1_val = str(df.iloc[r_idx, 1]).strip()
        data_vals = [str(df.iloc[r_idx, c]).strip() for c in range(2, len(df.columns))]
        has_data = any(v and v not in ['', '-', '.', '...'] for v in data_vals)
        is_total = any(k in c0_val.lower() for k in ['jumlah', 'total', 'kabupaten tasikmalaya', 'kab. tasikmalaya', 'tasikmalaya'])
        is_subtotal = any(k in c0_val.lower() for k in ['sub jumlah', 'sub total', 'sub-total'])
        if is_total:
            row_dict = {col0_name: c0_val if c0_val else 'Kabupaten Tasikmalaya'}
            for c_idx, col_name in enumerate(data_cols):
                row_dict[col_name] = data_vals[c_idx]
            new_rows.append(row_dict)
        elif is_subtotal:
            label = f'{current_group} - Sub Total' if current_group else c0_val
            row_dict = {col0_name: label}
            for c_idx, col_name in enumerate(data_cols):
                row_dict[col_name] = data_vals[c_idx]
            new_rows.append(row_dict)
        elif c0_val and not c1_val and not has_data:
            current_group = c0_val
        elif c1_val:
            label = f'{current_group} - {c1_val}' if current_group else c1_val
            row_dict = {col0_name: label}
            for c_idx, col_name in enumerate(data_cols):
                row_dict[col_name] = data_vals[c_idx]
            new_rows.append(row_dict)
        elif c0_val and has_data:
            label = f'{current_group} - {c0_val}' if current_group else c0_val
            row_dict = {col0_name: label}
            for c_idx, col_name in enumerate(data_cols):
                row_dict[col_name] = data_vals[c_idx]
            new_rows.append(row_dict)
    return pd.DataFrame(new_rows)

def process_and_merge_results(results: List[Dict]) -> List[Dict]:
    if not results:
        return []
        
    table_groups = []
    current_group = [results[0]]
    current_tnum = results[0].get('table_number')

    for r in results[1:]:
        tnum = r.get('table_number')
        if tnum and current_tnum and tnum == current_tnum:
            current_group.append(r)
        elif not tnum and current_tnum:
            current_group.append(r)
        else:
            table_groups.append(current_group)
            current_group = [r]
            current_tnum = tnum
    if current_group:
        table_groups.append(current_group)

    merged_categories = []
    for group in table_groups:
        table_num = group[0].get('table_number')
        merged_df, pages = merge_subtables_for_table_group(group)
        # Normalisasi khusus tabel hierarki jika terdeteksi
        merged_df = normalize_two_level_hierarchical_table(merged_df)
        merged_categories.append({
            "category_id": len(merged_categories) + 1,
            "table_number": table_num,
            "dataframe": merged_df,
            "pages": pages,
            "index_row": group[0].get("index_row", [])
        })
    return merged_categories

# Konfigurasi logging
