import React from 'react';
import CreatableSelect, { CreatableProps } from 'react-select/creatable';
import Select, { Props as SelectProps } from 'react-select';
import { StylesConfig, GroupBase } from 'react-select';

export type OmniaSelectVariant = 'dark' | 'light';

export interface OmniaSelectOption {
  value: string;
  label: string;
  isNew?: boolean;
}

export interface OmniaSelectProps extends Omit<CreatableProps<OmniaSelectOption, false, GroupBase<OmniaSelectOption>>, 'styles' | 'options' | 'value' | 'onChange'> {
  variant?: OmniaSelectVariant;
  options: string[] | OmniaSelectOption[];
  value?: string | null;
  onChange?: (value: string | null) => void;
  onCreateOption?: (inputValue: string) => void | Promise<void>;
  placeholder?: string;
  isDisabled?: boolean;
  isInvalid?: boolean;
  showSearchIcon?: boolean;
  className?: string;
  isCreatable?: boolean; // Se false, disabilita la creazione di nuove opzioni
}

const getStyles = (variant: OmniaSelectVariant, isInvalid?: boolean, showSearchIcon?: boolean): StylesConfig<OmniaSelectOption, false> => {
  if (variant === 'dark') {
    return {
      control: (base, state) => ({
        ...base,
        backgroundColor: '#334155', // slate-700
        borderColor: isInvalid
          ? '#ef4444' // red-500
          : state.isFocused
          ? '#a855f7' // purple-500
          : '#475569', // slate-600
        borderWidth: '1px',
        borderRadius: '0.5rem',
        boxShadow: state.isFocused && !isInvalid
          ? '0 0 0 2px rgba(168, 85, 247, 0.5)'
          : 'none',
        minHeight: '48px',
        paddingLeft: showSearchIcon ? '2rem' : '1rem',
        paddingRight: '0.5rem',
        '&:hover': {
          borderColor: isInvalid ? '#ef4444' : '#a855f7',
        },
      }),
      input: (base) => ({
        ...base,
        color: '#ffffff',
        margin: 0,
        padding: 0,
        fontWeight: 'normal',
      }),
      placeholder: (base) => ({
        ...base,
        color: '#94a3b8', // slate-400
        fontWeight: 'normal',
      }),
      singleValue: (base, state) => ({
        ...base,
        color: state.data?.isNew ? '#60a5fa' : '#ffffff', // blue-400 per nuove voci
        fontWeight: 'normal',
      }),
      menu: (base) => ({
        ...base,
        backgroundColor: '#1e293b', // slate-800
        borderColor: '#334155', // slate-700
        borderRadius: '0.5rem',
        marginTop: '0.5rem',
      }),
      option: (base, state) => ({
        ...base,
        backgroundColor: state.isSelected
          ? '#475569' // slate-600
          : state.isFocused
          ? '#334155' // slate-700
          : 'transparent',
        color: '#ffffff',
        padding: '0.5rem 1rem',
        '&:hover': {
          backgroundColor: '#334155',
        },
      }),
      indicatorSeparator: () => ({
        display: 'none',
      }),
      dropdownIndicator: (base) => ({
        ...base,
        color: '#94a3b8', // slate-400
        padding: '0 0.125rem',
        '& svg': {
          strokeWidth: 0.5, // Più fine
          width: '10px', // Più piccola
          height: '10px',
        },
        '&:hover': {
          color: '#ffffff',
        },
      }),
    };
  } else {
    // Light theme (LandingPage)
    return {
      control: (base, state) => ({
        ...base,
        backgroundColor: '#ffffff',
        borderColor: state.isFocused ? '#10b981' : '#a7f3d0', // emerald-500 : emerald-200
        borderWidth: '1px',
        borderRadius: '0.25rem',
        boxShadow: state.isFocused ? '0 0 0 1px #10b981' : 'none',
        minHeight: '28px',
        paddingLeft: showSearchIcon ? '1.5rem' : '0.5rem',
        paddingRight: '0.125rem',
        '&:hover': {
          borderColor: '#10b981',
        },
      }),
      input: (base) => ({
        ...base,
        color: '#064e3b', // emerald-900
        padding: '2px 0',
        margin: 0,
        fontWeight: 'normal',
      }),
      placeholder: (base) => ({
        ...base,
        color: '#10b981', // emerald-600
        fontWeight: 'normal',
      }),
      singleValue: (base) => ({
        ...base,
        color: '#064e3b', // emerald-900
        fontWeight: 'normal',
      }),
      menu: (base) => ({
        ...base,
        backgroundColor: '#ffffff',
        borderColor: '#a7f3d0', // emerald-200
        borderRadius: '0.25rem',
        marginTop: '0.25rem',
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
      }),
      option: (base, state) => {
        // Se è il separatore, renderlo come linea orizzontale
        if (state.data?.value === '__separator__') {
          return {
            ...base,
            backgroundColor: 'transparent',
            color: '#a7f3d0', // emerald-200
            padding: '0.125rem 0.75rem', // Padding minimo
            cursor: 'default',
            borderBottom: '1px solid #a7f3d0', // Linea separatrice
            margin: '0.125rem 0',
            '&:hover': {
              backgroundColor: 'transparent',
            },
          };
        }
        return {
          ...base,
          backgroundColor: state.isSelected
            ? '#d1fae5' // emerald-100
            : state.isFocused
            ? '#ecfdf5' // emerald-50
            : 'transparent',
          color: '#064e3b', // emerald-900
          padding: '0.25rem 0.75rem', // Ridotto padding verticale
          '&:hover': {
            backgroundColor: '#ecfdf5',
          },
        };
      },
      group: (base) => ({
        ...base,
        padding: 0,
      }),
      groupHeading: (base) => ({
        ...base,
        padding: '0.25rem 0.75rem',
        fontSize: '0.75rem',
        fontWeight: 600,
        color: '#059669',
        textTransform: 'none',
        borderBottom: '1px solid #a7f3d0', // Separatore per tutta la larghezza
        marginBottom: 0,
      }),
      indicatorSeparator: () => ({
        display: 'none',
      }),
      dropdownIndicator: (base) => ({
        ...base,
        color: '#10b981', // emerald-600
        padding: '0 0.125rem',
        '& svg': {
          strokeWidth: 0.5, // Più fine
          width: '10px', // Più piccola
          height: '10px',
        },
        '&:hover': {
          color: '#059669',
        },
      }),
    };
  }
};

export const OmniaSelect: React.FC<OmniaSelectProps> = ({
  variant = 'dark',
  options,
  value,
  onChange,
  onCreateOption,
  placeholder,
  isDisabled = false,
  isInvalid = false,
  showSearchIcon = false,
  className = '',
  isCreatable = true, // Default: abilita creazione
  ...rest
}) => {
  // Converti options da string[] a OmniaSelectOption[]
  const selectOptions: OmniaSelectOption[] = React.useMemo(() => {
    if (options.length === 0) return [];
    if (typeof options[0] === 'string') {
      return (options as string[]).map(opt => ({ value: opt, label: opt }));
    }
    return options as OmniaSelectOption[];
  }, [options]);

  // Trova l'opzione corrente
  const selectedOption = React.useMemo(() => {
    if (!value) return null;
    return selectOptions.find(opt => opt.value === value) || { value, label: value, isNew: true };
  }, [value, selectOptions]);

  const handleChange = (newValue: OmniaSelectOption | null) => {
    if (onChange) {
      onChange(newValue?.value || null);
    }
  };

  const handleCreateOption = async (inputValue: string) => {
    if (onCreateOption) {
      await onCreateOption(inputValue);
    }
    if (onChange) {
      onChange(inputValue);
    }
  };

  const styles = getStyles(variant, isInvalid, showSearchIcon);

  // Se isCreatable è false, usa Select normale invece di CreatableSelect
  if (!isCreatable) {
    return (
      <div className={`relative ${className}`}>
        {showSearchIcon && variant === 'light' && (
          <div className="absolute left-2 top-1/2 transform -translate-y-1/2 z-10 pointer-events-none">
            <svg className="w-3 h-3 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        )}
        <Select<OmniaSelectOption, false>
          options={selectOptions}
          value={selectedOption}
          onChange={handleChange}
          placeholder={placeholder}
          isDisabled={isDisabled}
          isClearable={false}
          isSearchable={true}
          styles={styles}
          {...rest}
        />
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {showSearchIcon && variant === 'light' && (
        <div className="absolute left-2 top-1/2 transform -translate-y-1/2 z-10 pointer-events-none">
          <svg className="w-3 h-3 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      )}
      <CreatableSelect<OmniaSelectOption, false>
        options={selectOptions}
        value={selectedOption}
        onChange={handleChange}
        onCreateOption={onCreateOption ? handleCreateOption : undefined}
        placeholder={placeholder}
        isDisabled={isDisabled}
        isClearable={false}
        isSearchable={true}
        styles={styles}
        formatCreateLabel={(inputValue) => `Create "${inputValue}"`}
        {...rest}
      />
    </div>
  );
};

